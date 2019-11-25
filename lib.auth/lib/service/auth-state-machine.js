import { Machine, State, interpret } from 'xstate';
import {
	clone,
	cloneDeep,
	ErrorCodes,
	ErrorMessages,
	generateToken,
	AutoFillCache,
	MethodInvoker,
	makeHTTPSRequest
} from '@marin/lib.utils';
import { createException } from '../error';
import { PasswordsManager } from './passwords-manager';
import { logger } from '../logger';
import { sendTOTPviaSMS } from '../utils/sms';
import { sendNotificationMFAFailedEmail } from '../utils/email';
import { AUTH_STEP } from '../enums';

/** States of the authentication process */
const STATES = {
	INIT: 'INIT',
	SECRET: 'SECRET',
	TOTP: 'TOTP',
	TOTP_GENERATOR: 'TOTP_GENERATOR',
	RECAPTCHA: 'RECAPTCHA',
	INCORRECT_CREDENTIALS: 'INCORRECT_CREDENTIALS',
	AUTHENTICATED: 'AUTHENTICATED'
};

/** Allowed event types */
const EVENT_TYPE = {
	SECRET_RECEIVED: 'SECRET_RECEIVED',
	TOTP_RECEIVED: 'TOTP_RECEIVED',
	GENERATE_TOTP: 'GENERATE_TOTP',
	RECAPTCHA: 'RECAPTCHA_RECEIVED',
	INCORRECT_CREDENTIALS_RECEIVED: 'INCORRECT_CREDENTIALS_RECEIVED',
	AUTH_PASSED: 'AUTH_PASSED'
};

/** Resources which are cached between invoking actions of state machine */
const CACHED_RESOURCES = {
	ACCOUNT: 'ACCOUNT'
};

/**
 * @typedef {{
 *   account: IAccountEntity,
 *	 bannedIp: IBannedIpEntity,
 *	 authSession: IAuthSessionEntity,
 *	 failedAuthAttempt: IFailedAuthAttemptEntity
 * }} EntitiesUsedByAuthStateMachine
 */

/** @type { EntitiesUsedByAuthStateMachine } */
let entitiesG;

const ENTITIES_RETRIEVERS_GENERATORS = {
	[CACHED_RESOURCES.ACCOUNT]: username => () => entitiesG.account.read(username)
};

/**
 * @typedef {{
 *     pepper: string,
 *     totpManager: TOTP,
 *     recaptcha: string,
 *     adminEmail: string
 * }} SecretsUsedByAuthStateMachine
 */

/** @type {SecretsUsedByAuthStateMachine} */
let secretsG;

/**
 * @typedef {{
 *   recaptcha: number
 *	 failedAuthAttempts: number
 * }} ThresholdsUsedByAuthStateMachine
 */

/** @type {ThresholdsUsedByAuthStateMachine} */
let thresholdsG;

/**
 * @typedef {{
 *     accountLocker: AccountLocker
 * }} ManagersUsedByAuthStateMachine
 */

/** @type {ManagersUsedByAuthStateMachine} */
let managersG;

/**
 * @typedef {{
 *     bannedIP: number
 * }} TTLUsedByAuthStateMachine
 */

/** @type {TTLUsedByAuthStateMachine} */
let ttlG;

/** FIXME there needs to be implemented a dedicated cache with ttl into separate typescript module */
/** TODO test damn memory leaks for fuck sake after each operation */
/**
 * @type {Map<string, Map<string, AutoFillCache>>}
 */
const cachedResources = new Map();

/**
 * @param {string} authSessionId
 * @param {string} resourceName
 * @param {string} resourceId
 * @param {function} [resourceRetriever]
 *
 * @return {Promise<Optional<any>>}
 */
async function getMyCachedResource(authSessionId, resourceName, resourceId, resourceRetriever) {
	let stateMachineResources = cachedResources.get(authSessionId);
	if (!stateMachineResources) {
		stateMachineResources = new Map();
		cachedResources.set(authSessionId, stateMachineResources);
	}
	let resourceCache = stateMachineResources.get(resourceName);
	if (!resourceCache) {
		resourceCache = new AutoFillCache(
			resourceRetriever || ENTITIES_RETRIEVERS_GENERATORS[resourceName](resourceId),
			logger
		);
	}
	return resourceCache.get();
}

/**
 * @param {string} authSessionId
 */
function clearMyCachedResources(authSessionId) {
	cachedResources.delete(authSessionId);
}

/**
 * @type {MachineConfig<DefaultContext, StateSchema, EventObject>}
 */
const FSMConfig = {
	// Initial state
	initial: STATES.INIT,

	// Local context for the entire machine
	context: {
		usernameForWhichAuthSessionWasCreated: null,
		ipFromWhereAuthSessionWasCreated: null,
		multiFactorToken: null,
		failedAuthAttempts: null,
		requestWasValid: false,
		recaptchaRequired: false,
		secretStepPassed: false,
		multiFactorStepPassed: false
	},

	// State definitions
	states: {
		[STATES.INIT]: {
			on: {
				entry: ['validateRequest'],
				[EVENT_TYPE.SECRET_RECEIVED]: {
					target: STATES.SECRET,
					cond: 'requestWasValidAndMultiFactorStepIsNotTakingPlace'
				},
				[EVENT_TYPE.TOTP_RECEIVED]: {
					target: STATES.TOTP,
					cond: 'requestWasValidAndSecretStepDidTakePlace'
				}
			}
		},
		[STATES.SECRET]: {
			entry: ['processSecret'],
			on: {
				[EVENT_TYPE.GENERATE_TOTP]: {
					target: STATES.TOTP_GENERATOR,
					cond: 'secretStepDidTakePlace'
				},
				[EVENT_TYPE.RECAPTCHA]: {
					target: STATES.RECAPTCHA
				},
				[EVENT_TYPE.INCORRECT_CREDENTIALS_RECEIVED]: {
					target: STATES.INCORRECT_CREDENTIALS
				},
				[EVENT_TYPE.AUTH_PASSED]: {
					target: STATES.AUTHENTICATED
				}
			}
		},
		[STATES.TOTP_GENERATOR]: {
			entry: ['generateTOTP'],
			type: 'final'
		},
		[STATES.TOTP]: {
			entry: ['processTOTP'],
			on: {
				[EVENT_TYPE.INCORRECT_CREDENTIALS_RECEIVED]: {
					target: STATES.INCORRECT_CREDENTIALS
				},
				[EVENT_TYPE.AUTH_PASSED]: {
					target: STATES.AUTHENTICATED
				}
			}
		},
		[STATES.RECAPTCHA]: {
			entry: ['checkRecaptcha'],
			on: {
				[EVENT_TYPE.INCORRECT_CREDENTIALS_RECEIVED]: {
					target: STATES.INCORRECT_CREDENTIALS
				},
				[EVENT_TYPE.AUTH_PASSED]: {
					target: STATES.AUTHENTICATED
				}
			}
		},
		[STATES.INCORRECT_CREDENTIALS]: {
			entry: ['handleIncorrectCredentials'],
			on: {
				[EVENT_TYPE.GENERATE_TOTP]: {
					target: STATES.TOTP_GENERATOR,
					cond: 'secretStepDidTakePlace'
				}
			}
		},
		[STATES.AUTHENTICATED]: {
			entry: ['createNewSession'],
			type: 'final'
		}
	},

	// Strict execution
	strict: true
};

/**
 * @type {Partial<MachineOptions<DefaultContext, EventObject>>}
 */
const FSMOptions = {
	guards: {
		requestWasValidAndMultiFactorStepIsNotTakingPlace: context =>
			context.requestWasValid && context.multiFactorToken != null,
		requestWasValidAndSecretStepDidTakePlace: context => context.requestWasValid && context.secretStepPassed,
		secretStepDidTakePlace: context => context.secretStepPassed
	},
	actions: {
		validateRequest: (context, event) => {
			const { usernameForWhichAuthSessionWasCreated, ipFromWhereAuthSessionWasCreated } = context;
			const { username, ip } = event.payload;
			if (username !== usernameForWhichAuthSessionWasCreated) {
				// eslint-disable-next-line no-param-reassign
				context.requestWasValid = false;
				event.reject(createException(ErrorCodes.INVALID_USERNAME, ErrorMessages.INVALID_USERNAME));
			} else if (ip !== ipFromWhereAuthSessionWasCreated) {
				// eslint-disable-next-line no-param-reassign
				context.requestWasValid = false;
				event.reject(createException(ErrorCodes.INVALID_REQUEST, ErrorMessages.INVALID_REQUEST));
			}
		},
		processSecret: async (context, event) => {
			const { usernameForWhichAuthSessionWasCreated, recaptchaRequired } = context;
			const { authSessionId, password, PIN } = event.payload;
			const usedCredentialForAuth = password || PIN;
			const accountOptional = await getMyCachedResource(
				authSessionId,
				CACHED_RESOURCES.ACCOUNT,
				usernameForWhichAuthSessionWasCreated
			);
			accountOptional.ifPresentOrElse(
				async account => {
					const storedCredential = password ? account.password : account.pin;
					// eslint-disable-next-line no-param-reassign
					context.secretStepPassed = await PasswordsManager.isCorrect(
						usedCredentialForAuth,
						storedCredential,
						account.salt,
						secretsG.pepper
					);

					let nextEventType;
					if (context.secretStepPassed) {
						if (recaptchaRequired) {
							nextEventType = EVENT_TYPE.RECAPTCHA;
						} else if (PIN || account.mfa) {
							nextEventType = EVENT_TYPE.GENERATE_TOTP;
						} else {
							nextEventType = EVENT_TYPE.AUTH_PASSED;
						}
					} else {
						nextEventType = EVENT_TYPE.INCORRECT_CREDENTIALS_RECEIVED;
					}

					event.stateMachineRef.selfDispatch(event, { type: nextEventType });
				},
				() => event.reject(new Error('Account not found'))
			);
		},
		generateTOTP: async (context, event) => {
			const { usernameForWhichAuthSessionWasCreated } = context;
			const { authSessionId } = event.payload;

			// eslint-disable-next-line no-param-reassign
			context.multiFactorToken = secretsG.totpManager.generate();

			const accountOptional = await getMyCachedResource(
				authSessionId,
				CACHED_RESOURCES.ACCOUNT,
				usernameForWhichAuthSessionWasCreated
			);
			accountOptional.ifPresentOrElse(
				account => {
					const methodInvoker = new MethodInvoker(async () => {
						clearMyCachedResources(authSessionId);
						await sendTOTPviaSMS(account.telephone, context.multiFactorToken);
						await event.stateMachineRef.saveState();
						event.resolve({ nextStep: AUTH_STEP.MFA });
					});
					methodInvoker
						.logger(logger)
						.errHandler(error => event.reject(error))
						.safeInvokeAsync();
				},
				() => event.reject(new Error('Account not found'))
			);
		},
		processTOTP: async (context, event) => {
			const { multiFactorToken, usernameForWhichAuthSessionWasCreated } = context;
			const { TOTP, authSessionId, device, IP } = event.payload;
			if (secretsG.totpManager.check(TOTP, logger, multiFactorToken)) {
				event.stateMachineRef.selfDispatch(event, { type: EVENT_TYPE.AUTH_PASSED });
			} else {
				const accountOptional = await getMyCachedResource(
					authSessionId,
					CACHED_RESOURCES.ACCOUNT,
					usernameForWhichAuthSessionWasCreated
				);
				accountOptional.ifPresentOrElse(
					account => {
						const methodInvoker = new MethodInvoker(async () => {
							await sendNotificationMFAFailedEmail(account.email, device, IP);
							event.stateMachineRef.selfDispatch(event, {
								type: EVENT_TYPE.INCORRECT_CREDENTIALS_RECEIVED,
								payload: { totpNeedsToBeReGenerated: true }
							});
						});
						methodInvoker
							.logger(logger)
							.errHandler(error => event.reject(error))
							.safeInvokeAsync();
					},
					() => event.reject(new Error('Account not found'))
				);
				/** FIXME successful login attempt should do clean up for failed auth attempts */
			}
		},
		checkRecaptcha: async (context, event) => {
			try {
				const { recaptcha, IP } = event.payload;

				if (!recaptcha) {
					return event.stateMachineRef.selfDispatch(event, {
						type: EVENT_TYPE.INCORRECT_CREDENTIALS_RECEIVED
					});
				}

				const recaptchaIsCorrect =
					(await makeHTTPSRequest({
						hostname: 'google.com',
						path: `/recaptcha/api/siteverify?secret=${secretsG.recaptcha}&response=${recaptcha}&remoteip=${IP}`
					})).success === true;

				if (!recaptchaIsCorrect) {
					// eslint-disable-next-line no-param-reassign
					context.secretStepPassed = false; // revert changes commit by secret step
					return event.stateMachineRef.selfDispatch(event, {
						type: EVENT_TYPE.INCORRECT_CREDENTIALS_RECEIVED
					});
				}

				// eslint-disable-next-line no-param-reassign
				context.recaptchaRequired = false;
				return event.stateMachineRef.selfDispatch(event, { type: EVENT_TYPE.AUTH_PASSED });
			} catch (error) {
				return event.reject(error);
			}
		},
		handleIncorrectCredentials: async (context, event) => {
			try {
				const { failedAuthAttempts, usernameForWhichAuthSessionWasCreated } = context;
				const { authSessionId, ip, device, location, totpNeedsToBeReGenerated } = event.payload;

				const now = new Date().getTime();
				const username = usernameForWhichAuthSessionWasCreated;

				/* create or update failed auth attempts */
				if (!context.failedAuthAttempts) {
					// eslint-disable-next-line no-param-reassign
					context.failedAuthAttempts = { username, timestamp: now, ip, device, location, counter: 1 };
				} else {
					failedAuthAttempts.timestamp = now;
					failedAuthAttempts.ip = `${failedAuthAttempts.ip},${ip}`;
					failedAuthAttempts.device = `${failedAuthAttempts.device},${device}`;
					failedAuthAttempts.location = `${failedAuthAttempts.location},${location}`;
					failedAuthAttempts.counter += 1;
				}

				if (failedAuthAttempts.counter >= thresholdsG.failedAuthAttempts) {
					const accountOptional = await getMyCachedResource(
						authSessionId,
						CACHED_RESOURCES.ACCOUNT,
						usernameForWhichAuthSessionWasCreated
					);
					if (!accountOptional.isPresent()) {
						event.reject(new Error('Account not found'));
						return;
					}

					const account = accountOptional.get();
					const ipToBan = failedAuthAttempts.ip.split(',');

					const promises = [];
					promises.push(managersG.accountLocker.lock(account.id, account.email, secretsG.adminEmail));
					promises.push(entitiesG.bannedIp.create(username, ipToBan, ttlG.bannedIP));
					promises.push(entitiesG.failedAuthAttempt.create(failedAuthAttempts));
					promises.push(entitiesG.authSession.delete(authSessionId));
					await Promise.all(promises);

					event.reject(createException(ErrorCodes.LOCKED_ACCOUNT, 'Account has been locked'));
				} else if (failedAuthAttempts.counter >= thresholdsG.recaptcha) {
					// eslint-disable-next-line no-param-reassign
					context.recaptchaRequired = true;
					await event.stateMachineRef.saveState();
					event.reject(createException(ErrorCodes.RECAPTCHA_REQUIRED, ErrorMessages.RECAPTCHA_REQUIRED));
				} else if (totpNeedsToBeReGenerated) {
					event.stateMachineRef.selfDispatch(event, { type: EVENT_TYPE.GENERATE_TOTP });
				} else {
					await event.stateMachineRef.saveState();
					event.reject(
						createException(ErrorCodes.INCORRECT_CREDENTIALS, ErrorMessages.INCORRECT_CREDENTIALS)
					);
				}
			} catch (error) {
				event.reject(error);
			}
		},
		createNewSession: async (context, event) => {
			const { authSessionId } = event.payload;
			// create session
			// clear cached resources
			clearMyCachedResources(authSessionId);
			// remove auth session
			await entitiesG.authSession.delete(authSessionId);
			// pass credentials
		}
	}
};

/**
 * @typedef {{
 *     type: string
 *     payload: T,
 *     resolve: function,
 *     reject: function
 *     stateMachineRef: AuthenticationStateMachine
 * }} AuthEvent
 * @template T extends object
 */

/**
 * @typedef {{
 *	 sessionIdSize: number,
 *	 sessionTTL: number
 * }} IAuthenticationFSMOptions
 */

const storage = new WeakMap();
/**
 * Private class data
 *
 * @param {Object} _this This of the class
 * @return {{
 *    options: IAuthenticationFSMOptions,
 *    currentState: State<DefaultContext, EventObject>,
 *    authMachine: StateMachine<DefaultContext, StateSchema, EventObject>,
 *    authInterpreter: Interpreter<DefaultContext, StateSchema, EventObject>
 * }}
 */
const internal = _this => {
	return storage.get(_this);
};

/** Authentication Finite State Machine */
class AuthenticationStateMachine {
	/**
	 * @param {IAuthenticationFSMOptions} options
	 */
	constructor(options) {
		const privateThis = { options };
		storage.set(this, privateThis);
	}

	/**
	 * @param {EntitiesUsedByAuthStateMachine} entities
	 */
	static setEntities(entities) {
		entitiesG = entities;
	}

	/** @param {SecretsUsedByAuthStateMachine} secrets */
	static setSecrets(secrets) {
		secretsG = secrets;
	}

	/** @param {ThresholdsUsedByAuthStateMachine} thresholds */
	static setThresholds(thresholds) {
		thresholdsG = thresholds;
	}

	/** @param {TTLUsedByAuthStateMachine} ttl */
	static setTTLs(ttl) {
		ttlG = ttl;
	}

	/** @param {ManagersUsedByAuthStateMachine} managers */
	static setManagers(managers) {
		managersG = managers;
	}

	/**
	 * @param {string}	username
	 * @param {string}	ip
	 * @returns {Promise<string>} Auth Session Id
	 */
	async create(username, ip) {
		const privateThis = internal(this);

		let errMsg = ErrorMessages.INCORRECT_CREDENTIALS;
		(await entitiesG.account.read(username))
			.filter(account => {
				if (account.locked) {
					errMsg = ErrorMessages.LOCKED_ACCOUNT;
					return false;
				}
				return true;
			})
			.filter(account => {
				if (account.activated) {
					errMsg = ErrorMessages.NOT_ACTIVATED;
					return false;
				}
				return true;
			})
			.orElseThrow(() => createException(ErrorCodes.CREATE_SESSION_FAILED, errMsg));

		const bannedIPs = await entitiesG.bannedIp.read(username);
		if (bannedIPs.includes(ip)) {
			throw createException(ErrorCodes.BANNED_IP, `Can't authenticate due to banned IP ${ip}`);
		}

		const configShallowClone = clone(FSMConfig);

		configShallowClone.id = (await generateToken(privateThis.options.sessionIdSize)).plain;
		configShallowClone.context = cloneDeep(configShallowClone.context);
		configShallowClone.context.usernameForWhichAuthSessionWasCreated = username;
		configShallowClone.context.ipFromWhereAuthSessionWasCreated = ip;

		privateThis.authMachine = Machine(configShallowClone, FSMOptions);

		await entitiesG.authSession.create(
			configShallowClone.id,
			JSON.stringify(privateThis.authMachine.initialState),
			privateThis.options.sessionTTL
		);

		return configShallowClone.id;
	}

	/**
	 * @param {string}	authSessionId
	 * @returns {Promise<AuthenticationStateMachine>}
	 */
	async load(authSessionId) {
		const privateThis = internal(this);
		(await entitiesG.authSession.readById(authSessionId)).ifPresentOrElse(
			authSessionState => {
				const configShallowClone = clone(FSMConfig);
				configShallowClone.id = authSessionId;
				privateThis.authMachine = Machine(configShallowClone, FSMOptions);
				const stateDefinition = JSON.parse(authSessionState);
				const previousState = State.create(stateDefinition);
				privateThis.currentState = privateThis.authMachine.resolveState(previousState);
			},
			() => {
				throw createException(ErrorCodes.NO_SESSION, ErrorMessages.NO_SESSION);
			}
		);
		return this;
	}

	/**
	 * @returns {Promise<void>}
	 */
	async saveState() {
		const privateThis = internal(this);
		await entitiesG.authSession.update(
			privateThis.authMachine.id,
			JSON.stringify(privateThis.authMachine.initialState)
		);
	}

	/**
	 * Starts the authentication state machine
	 * @returns {AuthenticationStateMachine}
	 */
	start() {
		const privateThis = internal(this);
		privateThis.authInterpreter = interpret(privateThis.authMachine).start(privateThis.currentState);
		/** TODO define callbacks */
		return this;
	}

	/**
	 * @param {AuthEvent}	event
	 * @returns {Promise<any>}
	 */
	dispatch(event) {
		const privateThis = internal(this);
		privateThis.currentState = privateThis.authMachine.transition(privateThis.currentState, event);
		return new Promise((resolve, reject) => {
			// eslint-disable-next-line no-param-reassign
			event.resolve = resolve;
			// eslint-disable-next-line no-param-reassign
			event.reject = reject;
		});
	}

	/**
	 * @param {AuthEvent}	prevEvent
	 * @param {AuthEvent}	nextEvent
	 */
	selfDispatch(prevEvent, nextEvent) {
		const privateThis = internal(this);
		// eslint-disable-next-line no-param-reassign
		nextEvent.resolve = prevEvent.resolve;
		// eslint-disable-next-line no-param-reassign
		nextEvent.reject = prevEvent.reject;
		// eslint-disable-next-line no-param-reassign
		nextEvent.stateMachineRef = prevEvent.stateMachineRef;
		if (nextEvent.payload) {
			const keys = Object.keys(nextEvent.payload);
			for (let i = 0; i < keys.length; i += 1) {
				// eslint-disable-next-line no-param-reassign
				prevEvent.payload[keys[i]] = nextEvent.payload[keys[i]];
			}
		}
		// eslint-disable-next-line no-param-reassign
		nextEvent.payload = prevEvent.payload;
		privateThis.currentState = privateThis.authMachine.transition(privateThis.currentState, nextEvent);
	}
}

/**
 * @param {IAuthInput}	data
 * @throws {Exception}
 * @return {AuthEvent}
 * */
function eventFrom(data) {
	const /** @type {AuthEvent} */ event = { payload: data };
	if (data.TOTP) {
		event.type = EVENT_TYPE.TOTP_RECEIVED;
	} else if (data.password || data.IP) {
		event.type = EVENT_TYPE.SECRET_RECEIVED;
	} else {
		throw createException(ErrorCodes.INVALID_ARGUMENT, 'TOTP, Password or PIN needs to be sent');
	}
	return event;
}

export { AuthenticationStateMachine, eventFrom };

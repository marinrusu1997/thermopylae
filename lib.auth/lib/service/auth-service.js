import {
	TOTP,
	generateToken,
	compareTokens,
	makeHTTPSRequest,
	OP_STATUS,
	ACTIONS,
	LOG_CTX_COMPONENTS,
	RESOURCES
} from '@marin/lib.utils';
import { LogContext } from '@marin/lib.logger';
import { MethodInvoker } from '@marin/lib.utils/lib/method-invoker';
import { SecurityQuestions } from './security-questions';
import { AccountLocker } from './lock-account';
import { LogoutManager } from './logout-account';
import { PasswordsManager } from './passwords-manager';
import { ForgotPasswordManager } from './forgot-password';
import { logger } from '../logger';
import { ErrorCodes, ErrorMessages, createException } from '../error';
import { AUTH_STEP, FORGOT_PASSWORD_STEP, RECOVER_ACCOUNT_STEP } from '../enums';
import { optionsOrDefaults, registerNewSession, handleInvalidCredentials, nextMonthToTimestamp } from '../utils';
import { sendAuthFromDiffDeviceEmail, sendNotificationMFAFailedEmail, sendActivateAccountEmail } from '../utils/email';
import { sendTOTPviaSMS } from '../utils/sms';

const storage = new WeakMap();
/**
 * Private class data
 *
 * @param {Object} _this This of the class
 * @return {{
 *     opts: IOptions,
 *     jwt: Jwt,
 *     totp: TOTP,
 *     accountLocker: AccountLocker,
 *     securityQuestions: SecurityQuestions,
 *     logoutManager: LogoutManager,
 *     passwordsManager: PasswordsManager
 *     forgotPasswordManager: ForgotPasswordManager
 * }}
 */
const internal = _this => {
	let data = storage.get(_this);
	if (!data) {
		data = {};
		storage.set(_this, data);
	}
	return data;
};

/**
 * Checks if captcha is required, and if so, checks his value
 *
 * @param {string}      username
 * @param {string}      grecaptcha
 * @param {string}      recaptchaSecret
 * @param {string}      recaptchaIP
 *
 * @throws {Error}      When REQUEST to captcha validate fails
 *
 * @returns {Promise<boolean>}
 */
async function checkReCaptcha(username, grecaptcha, recaptchaSecret, recaptchaIP) {
	if (!grecaptcha) {
		return false;
	}
	return (
		(await makeHTTPSRequest({
			hostname: 'google.com',
			path: `/recaptcha/api/siteverify?secret=${recaptchaSecret}&response=${grecaptcha}&remoteip=${recaptchaIP}`
		})).success === true
	);
}

class AuthService {
	constructor(opts) {
		if (!opts.jwt || !opts.models || !opts.secrets.pepper) {
			throw createException(ErrorCodes.INVALID_CONFIG, 'Invalid config provided to Auth Service');
		}
		const privateThis = internal(this);
		privateThis.opts = optionsOrDefaults(opts);
		privateThis.jwt = opts.jwt.instance;
		privateThis.totp = new TOTP({ ttl: opts.ttl.totp, secret: opts.secrets.totp });
		privateThis.logoutManager = new LogoutManager({
			jwt: opts.jwt.instance,
			jwtRolesExpiration: opts.jwt.rolesExpiration,
			accountModel: opts.models.account,
			authSessionModel: opts.models.session
		});
		privateThis.accountLocker = new AccountLocker({
			unlockTokenSize: opts.size.token,
			unlockTokenTTL: opts.ttl.unlockAccount,
			accountModel: opts.models.account,
			unlockAccountSessionModel: opts.models.unlockAccountSession,
			accountLogoutManager: privateThis.logoutManager
		});
		privateThis.securityQuestions = new SecurityQuestions({
			securityQuestionsModel: opts.models.securityQuestions
		});
		privateThis.passwordsManager = new PasswordsManager({
			accountModel: opts.models.account,
			breachThreshold: opts.thresholds.breachPassword
		});
		privateThis.forgotPasswordManager = new ForgotPasswordManager({
			sessionTTL: opts.ttl.forgotPasswordSession,
			sessionIdSize: opts.size.token,
			guessThreshold: opts.thresholds.forgotPasswordGuesses,
			adminEmail: opts.email.admin,
			accountModel: opts.models.account,
			personModel: opts.models.person,
			forgotPasswordSessionModel: opts.models.forgotPasswordSession,
			accountLocker: privateThis.accountLocker,
			securityQuestions: privateThis.securityQuestions,
			passwordsManager: privateThis.passwordsManager,
			logoutManager: privateThis.logoutManager
		});
	}

	async authenticate(data) {
		/** Maybe it can be modelled as a state machine */
		const { jwt, totp, opts } = internal(this);
		const { models, secrets } = opts;
		const { pepper } = secrets;
		logger.info(`Authenticating ${data.username}`);

		const account = await models.account.read(data.username);
		if (!account) {
			throw createException(ErrorCodes.INCORRECT_CREDENTIALS, ErrorCodes.INCORRECT_CREDENTIALS);
		}

		if (account.locked) {
			throw createException(
				ErrorCodes.LOCKED_ACCOUNT,
				`Can't authenticate due to locked status for account ${account.username}`
			);
		}
		if (!account.activated) {
			throw createException(
				ErrorCodes.NOT_ACTIVATED,
				`Can't authenticate due to not activated account ${account.username}`
			);
		}

		const banned = await models.bannedIP.read(account.username);
		if (banned.includes(data.IP)) {
			throw createException(ErrorCodes.BANNED_IP, `Can't authenticate due to banned IP ${data.IP}`);
		}

		const mfaSession = await models.mfaSession.read(data.username, data.device);
		const authWithMFARequired = mfaSession !== null;

		if (authWithMFARequired) {
			if (!totp.check(data.TOTP, logger, mfaSession.totp)) {
				/** FIXME captcha required only on logins with password, for MFA it does not make sense */
				await handleInvalidCredentials.call(this, data, account, opts);
				await sendNotificationMFAFailedEmail(account.email, data.device, data.IP);
				/** FIXME maybe send and update only if account was not locked */
				const totpToken = totp.generate();
				await models.mfaSession.updateTOTP(data.username, data.device, totpToken);
				await sendTOTPviaSMS(account.telephone, totpToken);
				throw createException(ErrorCodes.INCORRECT_CREDENTIALS, ErrorMessages.INCORRECT_CREDENTIALS);
			}
		} else {
			const usedCredentialForAuth = data.password || data.PIN;
			const storedCredential = data.password ? account.password : account.pin;
			if (!(await PasswordsManager.isCorrect(usedCredentialForAuth, storedCredential, account.salt, pepper))) {
				await handleInvalidCredentials.call(this, data, account, opts);
				throw createException(ErrorCodes.INCORRECT_CREDENTIALS, ErrorMessages.INCORRECT_CREDENTIALS);
			}

			const recaptchaRequired = await models.recaptcha.read(data.username);
			if (recaptchaRequired) {
				if (await checkReCaptcha(data.username, data.recaptcha, secrets.recaptcha, data.IP)) {
					await models.recaptcha.delete(data.username);
					await models.failedAuthAttemptSession.delete(data.username);
				} else {
					await handleInvalidCredentials.call(this, data, account, opts);
					throw createException(ErrorCodes.INCORRECT_CREDENTIALS, ErrorMessages.INCORRECT_CREDENTIALS);
				}
			}

			if (data.PIN || account.mfa) {
				logger.info(`Attempt to authenticate into account with required MFA ${data.username}`);
				const totpToken = totp.generate();
				await opts.models.mfaSession.create(
					{
						username: data.username,
						deviceId: data.device,
						totp: totpToken
					},
					opts.ttl.totp
				); // will have very short TTL, only auto-delete
				logger.info(`Sending TOTP for ${data.username}`);
				await sendTOTPviaSMS(account.telephone, totpToken);
				return { nextStep: AUTH_STEP.MFA };
			}
		}

		/** From now on, auth has been passed */
		if (account.compromised) {
			logger.warning(`Attempt to authenticate into compromised account ${data.username}`);
			return {
				nextStep: AUTH_STEP.RESET_PASSWORD,
				payload: await this.createResetPasswordSession(data.username)
			};
		}

		const accessPoints = await models.authAccessPoint.read(account.username);
		let accessPoint;
		let needToNotifyAboutLoginFromOtherDevice;
		for (let i = 0; i < accessPoints.length; i += 1) {
			accessPoint = accessPoints[i];
			if (accessPoint.device !== data.device && accessPoint.ip !== data.IP) {
				needToNotifyAboutLoginFromOtherDevice = true;
				break;
			}
		}
		if (needToNotifyAboutLoginFromOtherDevice) {
			logger.warning(
				`Attempt to authenticate into account ${data.username} from different device ${data.device} and ip ${data.IP}`
			);
			await sendAuthFromDiffDeviceEmail(account.email, account.id, accessPoint.device, accessPoint.ip);
		}

		/** FIXME this shit should be refactored into auth session builder */
		const authTokens = await registerNewSession(
			data,
			account,
			jwt,
			opts.jwt,
			opts.size.token,
			opts.models.session,
			opts.schedulers,
			authWithMFARequired
		);
		logger.info('Successful attempt to authenticate');
		return { nextStep: AUTH_STEP.COMPLETED, payload: authTokens };
	}

	async createResetPasswordSession(username) {
		const { opts } = internal(this);
		const token = await generateToken(opts.size.token);
		logger.info(`Creating reset password session for ${username}`);
		await opts.models.resetPasswordSession.create(username, token.plain, opts.ttl.resetPasswordToken);
		return token.plain;
	}

	async completeResetPassword(data, token) {
		const { jwt, passwordsManager, opts } = internal(this);
		const { models, secrets } = opts;
		const storedToken = await models.resetPasswordSession.read(data.username);
		if (!storedToken) {
			throw createException(ErrorCodes.INCORRECT_TOKEN, ErrorCodes.INCORRECT_TOKEN);
		}
		if (await compareTokens(storedToken, token)) {
			const account = await models.account.read(data.username);
			await passwordsManager.validateStrengthness(data.password);
			await models.account.rehabilitate(
				account.id,
				await PasswordsManager.hash(data.password, account.salt, secrets.pepper)
			);
			await new MethodInvoker(models.resetPasswordSession.delete, data.username)
				.logger(logger)
				.errMsg(
					LogContext.from({
						[LOG_CTX_COMPONENTS.ACTION]: ACTIONS.DELETE,
						[LOG_CTX_COMPONENTS.RESOURCE]: RESOURCES.RESET_PASSWORD_SESSION,
						[LOG_CTX_COMPONENTS.VARIABLES]: { accountId: account.id },
						[LOG_CTX_COMPONENTS.STATUS]: OP_STATUS.FAILED
					}).toString()
				)
				.safeInvokeAsync();

			/** FIXME this shit should be refactored */
			return registerNewSession(
				data,
				account,
				jwt,
				opts.jwt,
				opts.size.token,
				opts.models.session,
				opts.schedulers
			);
		}
		throw createException(ErrorCodes.INCORRECT_TOKEN, 'Reset password token is not correct');
	}

	/** @param {IRegistrationInfo} info */
	async register(info) {
		const { opts, securityQuestions, passwordsManager } = internal(this);
		let account = await opts.models.account.read(info.username);
		if (account) {
			throw createException(ErrorCodes.ALREADY_REGISTERED, 'Account is registered already');
		}
		await passwordsManager.validateStrengthness(info.password);
		const salt = await generateToken(opts.size.salt, false);
		const passwordHash = await PasswordsManager.hash(info.password, salt.plain, opts.secrets.pepper);
		const pinHash = await PasswordsManager.hash(info.PIN, salt.plain, opts.secrets.pepper);
		account = await opts.models.account.create({
			username: info.username,
			password: passwordHash,
			pin: pinHash,
			salt: salt.plain,
			email: info.email,
			telephone: info.telephone,
			role: info.role,
			activated: false,
			locked: false,
			compromised: false,
			mfa: info.useMFA
		});
		try {
			/** FIXME needs to be validated with Ajv */
			await securityQuestions.setQuestion(account.id, info.userQuestion.question, info.userQuestion.answer);
			await securityQuestions.setAnswers(account.id, info.answersToSecurityQuestions);
			/** FIXME person fields needs to be added as config */
			await opts.models.person.create({ accountId: account.id, birthday: info.birthday });
			const token = await generateToken(opts.size.token);
			const taskId = await opts.schedulers.account.delete(account.id);
			await opts.models.activateAccountSession.create(
				account.id,
				{ token: token.plain, taskId },
				opts.ttl.activateAccountSession
			);
			await sendActivateAccountEmail(account.email, token.plain, account.id);
		} catch (error) {
			await opts.models.account.delete(account.id);
			throw error;
		}
	}

	/**
	 * @param {number}	accountId
	 * @param {string} 	token
	 * */
	async activateAccount(accountId, token) {
		const { opts } = internal(this);

		const info = await opts.models.activateAccountSession.read(accountId);
		if (!(await compareTokens(info.token, token))) {
			throw createException(ErrorCodes.INCORRECT_TOKEN, 'Activate account token is not correct');
		}

		await opts.models.account.activate(accountId);
		await opts.schedulers.account.cancel(info.taskId);
		await opts.models.activateAccountSession.delete(accountId);
	}

	/**
	 * @param {number}	accountId
	 * @param {boolean}	activate
	 */
	async setMFAStatus(accountId, activate) {
		const { opts } = internal(this);
		logger.info('Changing MFA status');
		await opts.models.account.setMFA(accountId, activate);
	}

	async lockAccount(accountId, userEmail, adminEmail) {
		return internal(this).accountLocker.lock(accountId, userEmail, adminEmail);
	}

	async unlockAccount(token) {
		return internal(this).accountLocker.unlock(token);
	}

	/**
	 * @param {number} 	accountId
	 * @param {number}	jwtIat
	 * @param {string}	csrf
	 * @param {Map<number, string>}	oldAnswers
	 * @param {Map<number, string>}	newAnswers
	 */
	async changeAnswersForSecurityQuestions(accountId, jwtIat, csrf, oldAnswers, newAnswers) {
		const { opts, securityQuestions } = internal(this);
		/** FIXME validate new answers with Ajv */
		const session = await opts.models.session.readById(jwtIat);
		logger.debug('Checking CSRF token');
		if (!(await compareTokens(session.csrf, csrf, true))) {
			throw createException(ErrorCodes.INCORRECT_TOKEN, 'Invalid CSRF');
		}
		logger.debug('Checking old answers');
		if (!(await securityQuestions.checkAnswerBulk(accountId, oldAnswers, true))) {
			throw createException(ErrorCodes.INCORRECT_ANSWERS, ErrorMessages.INCORRECT_ANSWERS);
		}
		logger.info('Changing answers to security questions');
		await securityQuestions.setAnswers(accountId, newAnswers);
	}

	/** @param {IChangePasswordInput} data */
	async changePassword(data) {
		const { opts, securityQuestions, passwordsManager } = internal(this);
		const session = await opts.models.session.readById(data.jwtIat);
		logger.debug('Checking CSRF token');
		if (!(await compareTokens(session.csrf, data.csrf, true))) {
			throw createException(ErrorCodes.INCORRECT_TOKEN, 'Incorrect CSRF');
		}
		logger.debug('Checking answer to security question');
		if (!(await securityQuestions.checkAnswer(data.accountId, data.userQuestion.id, data.userQuestion.answer))) {
			throw createException(ErrorCodes.INCORRECT_ANSWERS, ErrorMessages.INCORRECT_ANSWERS);
		}
		const account = await opts.models.account.readById(data.accountId);
		await passwordsManager.change(
			data.accountId,
			data.newPassword,
			data.oldPassword,
			account.salt,
			opts.secrets.pepper
		);
	}

	/**
	 * @param {number}			accountId
	 * @param {ICredentials} 	credentials */
	async checkIdentity(accountId, credentials) {
		const { models, secrets } = internal(this).opts;
		logger.info('Check identity: reading account');
		const account = await models.account.readById(accountId);
		if (!account) {
			throw createException(ErrorCodes.INCORRECT_ACCOUNT, ErrorMessages.INCORRECT_ACCOUNT);
		}
		const { username, password, salt } = account;
		const isUsernameCorrect = username === credentials.username;
		const isPaswdCorrect = await PasswordsManager.isCorrect(credentials.password, password, salt, secrets.pepper);
		if (!(isUsernameCorrect && isPaswdCorrect)) {
			throw createException(ErrorCodes.INCORRECT_CREDENTIALS, ErrorMessages.INCORRECT_CREDENTIALS);
		}
	}

	/**
	 * @param {FORGOT_PASSWORD_STEP} step
	 * @param {IForgotPasswordInitInput
	 * 			| IForgotPasswordVerifyIdentityInput
	 * 			| IForgotPasswordVerifySecurityQuestionsInput
                | IForgotPasswordChangePasswordInput} data
	 * @param {string}	[sessionId]
	 *
	 * @returns {Promise<IForgotPasswordInitOutput
	 * 			| IForgotPasswordVerifyIdentityOutput
	 * 			| void>}
	 */
	// eslint-disable-next-line class-methods-use-this
	async forgotPassword(step, data, sessionId) {
		const { forgotPasswordManager } = internal(this);
		let output;
		switch (step) {
			case FORGOT_PASSWORD_STEP.CREATE_SESSION:
				output = await forgotPasswordManager.createSession(data);
				break;
			case FORGOT_PASSWORD_STEP.VERIFY_IDENTITY:
				output = await forgotPasswordManager.verifyIdentity(sessionId, data);
				break;
			case FORGOT_PASSWORD_STEP.VERIFY_SECURITY_QUESTIONS:
				output = await forgotPasswordManager.verifyAnswersToSecurityQuestions(sessionId, data);
				break;
			case FORGOT_PASSWORD_STEP.CHANGE_PASSWORD:
				output = await forgotPasswordManager.changePassword(sessionId, data);
				break;
			default:
				throw createException(ErrorCodes.INVALID_ARGUMENT, ErrorMessages.INVALID_ARGUMENT);
		}
		return output;
	}

	/** FIXME recover account */

	async logout(payload) {
		return internal(this).logoutManager.logout(payload);
	}

	/**
	 * @param {number} accountId
	 */
	async logoutFromAllDevices(accountId) {
		return internal(this).logoutManager.logoutFromAllDevices(accountId);
	}

	/**
	 * @param {SecurityQuestionLanguage} lang
	 */
	async getSecurityQuestions(lang) {
		return internal(this).securityQuestions.getCannedOnes(lang);
	}

	async getActiveSessions(username) {
		return (await internal(this).opts.models.session.read(username)).map(session => {
			// eslint-disable-next-line no-param-reassign
			delete session.csrf;
			return session;
		});
	}

	async getFailedLoginAttempts(username, month, year) {
		return internal(this).opts.models.failedAuthAttempt.read(
			username,
			new Date(year, month).getTime(),
			nextMonthToTimestamp(year, month)
		);
	}
}

export default AuthService;
export { AuthService };

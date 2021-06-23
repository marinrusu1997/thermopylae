import { ApiValidator } from '@thermopylae/lib.api-validator';
import { GeoIpLocator, GeoIpLiteRepository, IpLocateRepository, IpstackRepository } from '@thermopylae/lib.geoip';
import {
	AccountWithTotpSecret,
	AuthenticationEngine,
	TotpTwoFactorAuthStrategy,
	Argon2PasswordHashingAlgorithm,
	PasswordLengthValidator,
	PasswordStrengthValidator,
	PwnedPasswordValidator
} from '@thermopylae/lib.authentication';
import { SmsClient } from '@thermopylae/lib.sms';
import { EmailClient } from '@thermopylae/lib.email';
import { JwtUserSessionMiddleware, initLogger as initCoreJwtUserSessionLogger } from '@thermopylae/core.jwt-session';
import {
	AccountMySqlRepository,
	FailedAuthenticationsMysqlRepository,
	SuccessfulAuthenticationsMysqlRepository,
	ActivateAccountSessionRedisRepository,
	AuthenticationSessionRedisRepository,
	FailedAuthenticationAttemptsSessionRedisRepository,
	ForgotPasswordSessionRedisRepository,
	initLogger as initCoreAuthenticationLogger
} from '@thermopylae/core.authentication';
import { initLogger as initCoreUserSessionCommonsLogger } from '@thermopylae/core.user-session.commons';
import { ErrorCodes } from '@thermopylae/core.declarations';
import { RedisClientInstance, initLogger as initRedisClientLogger } from '@thermopylae/core.redis';
import { MySqlClientInstance, initLogger as initMysqlClientLogger } from '@thermopylae/core.mysql';
import { LoggerInstance } from '@thermopylae/core.logger';
import { publicEncrypt } from 'crypto';
import { Config } from '../config';
import { EnvironmentVariables } from './constants';
import { createException } from '../error';
import { initLogger, logger } from '../logger';

// eslint-disable-next-line import/no-mutable-exports
let API_VALIDATOR: ApiValidator;

// eslint-disable-next-line import/no-mutable-exports
let GEOIP_LOCATOR: GeoIpLocator;

// eslint-disable-next-line import/no-mutable-exports
let AUTHENTICATION_ENGINE: AuthenticationEngine<AccountWithTotpSecret>;

// eslint-disable-next-line import/no-mutable-exports
let JWT_USER_SESSION_MIDDLEWARE: JwtUserSessionMiddleware;

// eslint-disable-next-line import/no-mutable-exports
let SMS_CLIENT: SmsClient;

// eslint-disable-next-line import/no-mutable-exports
let EMAIL_CLIENT: EmailClient;

let bootstrapPerformed = false;

async function bootstrap() {
	if (bootstrapPerformed) {
		throw createException(ErrorCodes.NOT_ALLOWED, `Multiple bootstraps are not allowed.`);
	}

	/* INIT API VALIDATOR */
	API_VALIDATOR = new ApiValidator();
	await API_VALIDATOR.init('validation/schemes', ['core']);

	/* VALIDATE ENVIRONMENT */
	await API_VALIDATOR.validate('CONFIG', 'ENV_VARS', process.env);

	/* BUILD CONFIG */
	const config = new Config(process.env[EnvironmentVariables.CONFIG_FILES_PATH] as string, API_VALIDATOR);

	/* INIT LOGGING */
	const loggingConfig = await config.getLoggingConfig();
	if (loggingConfig.transports.FILE != null || loggingConfig.transports.GRAYLOG2 != null) {
		delete loggingConfig.formatting.colorize;
	}

	LoggerInstance.formatting.setDefaultRecipe(loggingConfig.formatting.format, {
		colorize: loggingConfig.formatting.colorize,
		ignoredLabels: loggingConfig.formatting.ignoredLabels != null ? new Set(loggingConfig.formatting.ignoredLabels) : undefined,
		levelForLabel: loggingConfig.formatting.levelForLabel,
		skippedFormatters: loggingConfig.formatting.skippedFormatters != null ? new Set(loggingConfig.formatting.skippedFormatters) : undefined
	});

	if (loggingConfig.transports.CONSOLE != null) {
		LoggerInstance.console.createTransport(loggingConfig.transports.CONSOLE);
	}
	if (loggingConfig.transports.FILE != null) {
		LoggerInstance.file.createTransport(loggingConfig.transports.FILE);
	}
	if (loggingConfig.transports.GRAYLOG2 != null) {
		for (const [input, endpoint] of Object.entries(loggingConfig.transports.GRAYLOG2.endpoints)) {
			LoggerInstance.graylog2.register(input, endpoint);
		}
		for (const [module, channel] of Object.entries(loggingConfig.transports.GRAYLOG2.channels)) {
			LoggerInstance.graylog2.setChannel(module, channel);
		}
	}

	/* INIT CORE LOGGERS */
	initLogger();
	initCoreAuthenticationLogger();
	initCoreUserSessionCommonsLogger();
	initCoreJwtUserSessionLogger();
	initMysqlClientLogger();
	initRedisClientLogger();

	/* INIT GEOIP */
	const geoipConfig = await config.getGeoIpConfig();
	GEOIP_LOCATOR = new GeoIpLocator([
		new GeoIpLiteRepository(geoipConfig.GEOIP_LITE.weight),
		new IpLocateRepository({
			...geoipConfig.IPLOCATE,
			hooks: {
				onIpRetrievalError(err) {
					logger.error('IpLocate failed to retrieve ip.', err);
				},
				onRateLimitExceeded(rateLimitReset) {
					logger.notice(`Rate limit for IpLocate was exceeded and will be reset on ${rateLimitReset}.`);
				}
			}
		}),
		new IpstackRepository({
			...geoipConfig.IPSTACK,
			hooks: {
				onIpRetrievalError(err) {
					logger.error('IpStack failed to retrieve ip.', err);
				}
			}
		})
	]);

	/* INIT SMS */
	SMS_CLIENT = new SmsClient(await config.getSmsConfig());

	/* INIT EMAIL */
	EMAIL_CLIENT = new EmailClient({
		...(await config.getEmailConfig()),
		hooks: {
			onTransportError(err) {
				logger.error('Error occurred on email transport.', err);
			},
			onTransportIdle() {
				logger.notice('Email transport is idle.');
			}
		}
	});

	/* INIT AUTHENTICATION ENGINE */
	const authEngineConfig = await config.getAuthenticationEngineConfig();
	const hashingAlgorithm = new Argon2PasswordHashingAlgorithm(authEngineConfig.password.hashing);

	AUTHENTICATION_ENGINE = new AuthenticationEngine<AccountWithTotpSecret>({
		thresholds: authEngineConfig.thresholds,
		ttl: authEngineConfig.ttl,
		repositories: {
			account: new AccountMySqlRepository(),
			successfulAuthentications: new SuccessfulAuthenticationsMysqlRepository(),
			failedAuthenticationAttempts: new FailedAuthenticationsMysqlRepository(),
			authenticationSession: new AuthenticationSessionRedisRepository(authEngineConfig.repositories.authenticationSessionKeyPrefix),
			failedAuthAttemptSession: new FailedAuthenticationAttemptsSessionRedisRepository(authEngineConfig.repositories.failedAuthAttemptsSessionKeyPrefix),
			forgotPasswordSession: new ForgotPasswordSessionRedisRepository(authEngineConfig.repositories.forgotPasswordSessionKeyPrefix),
			activateAccountSession: new ActivateAccountSessionRedisRepository(authEngineConfig.repositories.activateAccountSessionKeyPrefix)
		},
		password: {
			hashing: {
				algorithms: new Map([[0, hashingAlgorithm]]),
				currentAlgorithmId: 0,
				currentAlgorithm: hashingAlgorithm
			},
			encryption: false,
			strength: [
				new PasswordLengthValidator(authEngineConfig.password.minLength, authEngineConfig.password.maxLength),
				new PasswordStrengthValidator((account) => {
					const userInputs = [account.id, account.email, account.username, account.totpSecret];
					if (account.telephone) {
						userInputs.push(account.telephone);
					}
					return userInputs;
				}),
				new PwnedPasswordValidator(authEngineConfig.password.breachThreshold)
			],
			similarity: authEngineConfig.password.similarity,
			forgotPasswordTokenEncrypt: async (pubKey, token) => {
				return publicEncrypt(pubKey, Buffer.from(token)).toString('base64');
			}
		},
		hooks: {
			onAuthenticationFromDifferentContext: async (account, authenticationContext) => {
				try {
					await EMAIL_CLIENT.send({
						to: account.email,
						subject: 'Authentication from different context',
						text: `Authentication was performed from different context: ${JSON.stringify(authenticationContext)}.`
					});
				} catch (e) {
					logger.error(`Failed to send notification about authentication from different context via email for account with id '${account.id}'.`, e);
				}
			},
			onAccountDisabled: async (account) => {
				try {
					const deletedSessions = await JWT_USER_SESSION_MIDDLEWARE.sessionManager.deleteAll(account.id);
					logger.info(`Deleted ${deletedSessions} user sessions after account with id '${account.id}' was disabled.`);
				} catch (e) {
					logger.error(`Failed to invalidate all of the user sessions for account with id '${account.id}' after it was disabled.`, e);
				}
			},
			onPasswordChanged: async (account) => {
				try {
					const deletedSessions = await JWT_USER_SESSION_MIDDLEWARE.sessionManager.deleteAll(account.id);
					logger.info(`Deleted ${deletedSessions} user sessions after password has been changed for account with id '${account.id}'.`);
				} catch (e) {
					logger.error(`Failed to invalidate all of the user sessions for account with id '${account.id}' after it's password has been changed.`, e);
				}
			},
			onForgottenPasswordChanged: async (account) => {
				try {
					const deletedSessions = await JWT_USER_SESSION_MIDDLEWARE.sessionManager.deleteAll(account.id);
					logger.info(`Deleted ${deletedSessions} user sessions after forgotten password has been changed for account with id '${account.id}'.`);
				} catch (e) {
					logger.error(
						`Failed to invalidate all of the user sessions for account with id '${account.id}' after it's forgotten password has been changed.`,
						e
					);
				}
			}
		},
		validators: {
			recaptcha: async (authenticationContext) => {
				try {
					const googleResponse = await (
						await fetch(
							`https://www.google.com/recaptcha/api/siteverify?secret=${authEngineConfig.recaptcha.secretKey}&response=${authenticationContext.recaptcha}`,
							{
								method: 'POST'
							}
						)
					).json();

					if (googleResponse.success !== true) {
						return false;
					}

					if (googleResponse.score < authEngineConfig.recaptcha.score) {
						return false;
					}

					if (googleResponse.action !== '') {
						logger.crit(
							`FIXME recaptcha action. Google response: ${JSON.stringify(googleResponse)}. Authentication context: ${JSON.stringify(
								authenticationContext
							)}`
						);
						return false;
					}

					if (googleResponse.hostname !== authEngineConfig.recaptcha.hostname) {
						logger.warning(
							`Attempt to resolve google captcha from a hostname different than the one from config. Ip: ${
								authenticationContext.ip
							}, device: ${JSON.stringify(authenticationContext.device)}, location: ${JSON.stringify(authenticationContext.location)}.`
						);
						return false;
					}

					return true;
				} catch (e) {
					logger.error('Failed to validate recaptcha token.', e);
					return false;
				}
			}
		},
		email: {
			admin: authEngineConfig.adminEmail,
			sender: {
				notifyPasswordChanged: async (account, changePasswordContext) => {
					try {
						await EMAIL_CLIENT.send({
							to: account.email,
							subject: 'Password changed',
							text: `Password has been changed from ip: ${changePasswordContext.ip}, device: ${JSON.stringify(
								changePasswordContext.device
							)}, location: ${JSON.stringify(changePasswordContext.location)}.`
						});
					} catch (e) {
						logger.error(`Failed to send notification about password change via email for account with id '${account.id}'.`, e);
					}
				},
				notifyAdminAboutAccountDisabling: async (adminEmail, account, cause) => {
					try {
						await EMAIL_CLIENT.send({
							to: adminEmail,
							subject: 'Account disabled',
							text: `Account with id '${account.id}' has been disabled, because ${cause}`
						});
					} catch (e) {
						logger.error(`Failed to notify admin about account disabling via email for account with id '${account.id}'.`, e);
					}
				},
				notifyAccountDisabled: async (account, cause) => {
					try {
						await EMAIL_CLIENT.send({
							to: account.email,
							subject: 'Account disabled',
							text: `Your account has been disabled, because ${cause}`
						});
					} catch (e) {
						logger.error(`Failed to notify about account disabling via email for account with id '${account.id}'.`, e);
					}
				},
				notifyMultiFactorAuthenticationFailed: async (account, authenticationContext) => {
					try {
						await EMAIL_CLIENT.send({
							to: account.email,
							subject: 'Multi factor authentication failed',
							text: `Context ip: ${authenticationContext.ip}, device: ${JSON.stringify(authenticationContext.device)}, location: ${JSON.stringify(
								authenticationContext.location
							)}.`
						});
					} catch (e) {
						logger.error(`Failed to notify about multi factor authentication failure via email for account with id '${account.id}'.`, e);
					}
				},
				sendForgotPasswordToken: async (account, token) => {
					try {
						await EMAIL_CLIENT.send({
							to: account.email,
							subject: 'Forgot password token',
							text: token
						});
					} catch (e) {
						logger.error(`Failed to send forgot password token via email for account with id '${account.id}'.`, e);
					}
				},
				sendActivateAccountToken: async (account, token) => {
					try {
						await EMAIL_CLIENT.send({
							to: account.email,
							subject: 'Activate account token',
							text: token
						});
					} catch (e) {
						logger.error(`Failed to send activate account token via email for account with id '${account.id}'.`, e);
					}
				}
			}
		},
		smsSender: {
			sendForgotPasswordToken: async (account, token) => {
				try {
					await SMS_CLIENT.send(account.telephone!, `Forgot password token: ${token}`);
				} catch (e) {
					logger.error(`Failed to send forgot password token via sms for account with id '${account.id}'.`, e);
				}
			}
		},
		'2fa-strategy': new TotpTwoFactorAuthStrategy(authEngineConfig['2faStrategy']),
		tokensLength: authEngineConfig.tokensLength
	});

	/* INIT JWT USER SESSION MIDDLEWARE */
	// @FIXME

	/* CONNECT TO DATABASES */
	await RedisClientInstance.connect(await config.getRedisConfig());
	try {
		MySqlClientInstance.init(await config.getMysqlConfig());
	} catch (e) {
		await RedisClientInstance.disconnect();
		throw e;
	}

	bootstrapPerformed = true;
}

export { bootstrap, API_VALIDATOR, GEOIP_LOCATOR, AUTHENTICATION_ENGINE, JWT_USER_SESSION_MIDDLEWARE, SMS_CLIENT, EMAIL_CLIENT };

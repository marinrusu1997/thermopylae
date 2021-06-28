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
import { JwtUserSessionMiddleware, InvalidAccessTokensMemCache, initLogger as initCoreJwtUserSessionLogger } from '@thermopylae/core.jwt-session';
import { UserSessionRedisStorage, initLogger as initCoreUserSessionCommonsLogger } from '@thermopylae/core.user-session.commons';
// eslint-disable-next-line import/extensions
import { AVRO_SERIALIZER } from '@thermopylae/core.user-session.commons/dist/storage/serializers/jwt/avro';
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
import { ErrorCodes } from '@thermopylae/core.declarations';
import { RedisClientInstance, initLogger as initRedisClientLogger } from '@thermopylae/core.redis';
import { MySqlClientInstance, initLogger as initMysqlClientLogger } from '@thermopylae/core.mysql';
import { LoggerInstance } from '@thermopylae/core.logger';
import { publicEncrypt } from 'crypto';
import express, { Router } from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import addRequestId from 'express-request-id';
import helmet from 'helmet';
import fetch from 'node-fetch';
import cors from 'cors'; // @fixme remove and from package.json
import process from 'process';
import path from 'path';
import { JwtUserSessionManagerEvent } from '@thermopylae/lib.jwt-user-session';
import { Config } from '../config';
import { EnvironmentVariables, ROUTER_OPTIONS, SERVICE_NAME } from './constants';
import { createException } from '../error';
import { initLogger, logger } from '../logger';
import { authenticationRouter } from '../api/routes/authentication/router';
import { morganMiddleware } from '../api/middleware/morgan';
import {
	API_VALIDATOR,
	EMAIL_CLIENT,
	initApiServer,
	initApiValidator,
	initAuthenticationEngine,
	initEmailClient,
	initGeoipLocator,
	initJwtUserSessionMiddleware,
	initSmsClient,
	JWT_USER_SESSION_MIDDLEWARE,
	SERVER,
	SMS_CLIENT
} from './singletons';
import { serverError } from '../api/middleware/server-error';
import { requiresAuthentication } from '../api/middleware/session';
import { stringifyOperationContext } from '../utils';
import { API_SCHEMA as AUTHENTICATION_API_SCHEMA } from '../api/routes/authentication/schema';
import { API_SCHEMA as SESSION_API_SCHEMA } from '../api/routes/session/schema';
import { userSessionRouter } from '../api/routes/session/router';

let bootstrapPerformed = false;

async function bootstrap() {
	if (bootstrapPerformed) {
		throw createException(ErrorCodes.NOT_ALLOWED, `Multiple bootstraps are not allowed.`);
	}

	/* INIT API VALIDATOR */
	initApiValidator(new ApiValidator());
	await API_VALIDATOR.init('./validation/schemes', ['core']);

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
		colorize: loggingConfig.formatting.colorize ? { [SERVICE_NAME]: 'olive' } : false,
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

	logger.debug('Logging initialized.');

	/* INIT GEOIP */
	const geoipConfig = await config.getGeoIpConfig();
	initGeoipLocator(
		new GeoIpLocator([
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
		])
	);

	logger.debug('GeoIp initialized.');

	/* INIT SMS */
	initSmsClient(new SmsClient(await config.getSmsConfig()));
	logger.debug('Sms client initialized.');

	/* INIT EMAIL */
	initEmailClient(
		new EmailClient({
			...(await config.getEmailConfig()),
			hooks: {
				onTransportError(err) {
					logger.error('Error occurred on email transport.', err);
				},
				onTransportIdle() {
					logger.notice('Email transport is idle.');
				}
			}
		})
	);
	logger.debug('Email client initialized.');

	/* INIT AUTHENTICATION ENGINE */
	const authEngineConfig = await config.getAuthenticationEngineConfig();
	const hashingAlgorithm = new Argon2PasswordHashingAlgorithm(authEngineConfig.password.hashing);

	initAuthenticationEngine(
		new AuthenticationEngine<AccountWithTotpSecret>({
			thresholds: authEngineConfig.thresholds,
			ttl: authEngineConfig.ttl,
			repositories: {
				account: new AccountMySqlRepository(),
				successfulAuthentications: new SuccessfulAuthenticationsMysqlRepository(),
				failedAuthenticationAttempts: new FailedAuthenticationsMysqlRepository(),
				authenticationSession: new AuthenticationSessionRedisRepository(authEngineConfig.repositories.authenticationSessionKeyPrefix),
				failedAuthAttemptSession: new FailedAuthenticationAttemptsSessionRedisRepository(
					authEngineConfig.repositories.failedAuthAttemptsSessionKeyPrefix
				),
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
							text: `Authentication was performed from different context. ${stringifyOperationContext(authenticationContext)}`
						});
					} catch (e) {
						logger.error(
							`Failed to send notification about authentication from different context via email for account with id '${account.id}'.`,
							e
						);
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
						logger.error(
							`Failed to invalidate all of the user sessions for account with id '${account.id}' after it's password has been changed.`,
							e
						);
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
							logger.warning("Google recaptcha wasn't solved.");
							return false;
						}

						if (googleResponse.score < authEngineConfig.recaptcha.score) {
							logger.warning(`Google captcha has a score that's below the one from config. Given score: '${googleResponse.score}'.`);
							return false;
						}

						if (googleResponse.action !== authEngineConfig.recaptcha.action) {
							logger.warning(
								`Attempt to resolve google captcha with an action different than the one from config. Given action: '${googleResponse.action}'.`
							);
							return false;
						}

						if (googleResponse.hostname !== authEngineConfig.recaptcha.hostname) {
							logger.warning(
								`Attempt to resolve google captcha from a hostname different than the one from config. Given hostname: '${googleResponse.hostname}'.`
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
								text: `Password has been changed. ${stringifyOperationContext(changePasswordContext)}`
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
								text: stringifyOperationContext(authenticationContext)
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
							e.message = `Failed to send forgot password token via email for account with id '${account.id}'.'. ${e.message}`;
							throw e;
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
							e.message = `Failed to send activate account token via email. ${e.message}`;
							throw e;
						}
					}
				}
			},
			smsSender: {
				sendForgotPasswordToken: async (account, token) => {
					try {
						await SMS_CLIENT.send(account.telephone!, `Forgot password token: ${token}`);
					} catch (e) {
						e.message = `Failed to send forgot password token via sms for account with id '${account.id}'. ${e.message}`;
						throw e;
					}
				}
			},
			'2fa-strategy': new TotpTwoFactorAuthStrategy(authEngineConfig['2faStrategy']),
			tokensLength: authEngineConfig.tokensLength
		})
	);
	logger.debug('Authentication engine initialized.');

	/* INIT JWT USER SESSION MIDDLEWARE */
	const jwtConfig = await config.getJwtUserSessionMiddlewareConfig();
	initJwtUserSessionMiddleware(
		new JwtUserSessionMiddleware({
			jwt: {
				secret: jwtConfig.jwt.secret,
				invalidationOptions: {
					refreshTokenLength: jwtConfig.jwt.invalidationOptions.refreshTokenLength,
					refreshTokenTtl: jwtConfig.jwt.invalidationOptions.refreshTokenTtl,
					refreshTokensStorage: new UserSessionRedisStorage({
						keyPrefix: jwtConfig.jwt.invalidationOptions.refreshTokensStorage.keyPrefix,
						concurrentSessions: jwtConfig.jwt.invalidationOptions.refreshTokensStorage.concurrentSessions,
						serializer: AVRO_SERIALIZER
					}),
					invalidAccessTokensCache: new InvalidAccessTokensMemCache()
				},
				signOptions: jwtConfig.jwt.signOptions,
				verifyOptions: jwtConfig.jwt.verifyOptions
			},
			session: jwtConfig.session
		})
	);
	JWT_USER_SESSION_MIDDLEWARE.sessionManager.on(JwtUserSessionManagerEvent.SESSION_INVALIDATED, () => {
		logger.crit(
			'JWT session was invalidated. Reminder in case app is run in cluster mode, it needs to send event to other nodes, so that they can invalidate this session.'
		);
	});
	JWT_USER_SESSION_MIDDLEWARE.sessionManager.on(JwtUserSessionManagerEvent.ALL_SESSIONS_INVALIDATED, () => {
		logger.crit(
			'All JWT session were invalidated. Reminder in case app is run in cluster mode, it needs to send event to other nodes, so that they can invalidate this session.'
		);
	});

	logger.debug('Jwt user session middleware initialized.');

	/* CONNECT TO DATABASES */
	await RedisClientInstance.connect(await config.getRedisConfig());
	try {
		MySqlClientInstance.init(await config.getMysqlConfig());
	} catch (e) {
		await RedisClientInstance.disconnect();
		throw e;
	}

	/* INIT APP */
	const appConfig = await config.getAppConfig();

	const app = express();
	app.set('trust proxy', 1);
	app.use(cors({ origin: 'http://localhost:63342', credentials: true })); // @fixme remove this
	app.use(bodyParser.json());
	app.use(cookieParser());
	app.use(
		addRequestId({
			setHeader: false
		})
	);
	app.use(helmet.hidePoweredBy());
	app.use(morganMiddleware);

	// setup routes
	const unlessOptions = {
		useOriginalUrl: true,
		path: new Array<string>()
	};
	for (const serviceMethod of Object.values(AUTHENTICATION_API_SCHEMA)) {
		if (!serviceMethod.requiresSession) {
			unlessOptions.path.push(path.join(appConfig.api.path.base, appConfig.api.path.authentication, serviceMethod.path));
		}
	}
	for (const serviceMethod of Object.values(SESSION_API_SCHEMA)) {
		if (!serviceMethod.requiresSession) {
			unlessOptions.path.push(path.join(appConfig.api.path.base, appConfig.api.path.session, serviceMethod.path));
		}
	}
	const apiRouter = Router(ROUTER_OPTIONS);
	apiRouter.use(appConfig.api.path.authentication, authenticationRouter);
	apiRouter.use(appConfig.api.path.session, userSessionRouter);
	app.use(appConfig.api.path.base, requiresAuthentication(unlessOptions), apiRouter);

	app.use(serverError);

	await new Promise<void>((resolve) => {
		initApiServer(
			app.listen(appConfig.listen.port, appConfig.listen.host, () => {
				logger.info(`Express server listening on http://${appConfig.listen.host}:${appConfig.listen.port}`);
				resolve();
			})
		);
	});

	/* CONFIGURE PROCESS LISTENERS */
	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);
	process.on('multipleResolves', (type, _promise, value) => {
		logger.alert(`Multiple resolves detected. Type: ${type}. Value: ${JSON.stringify(value)} .`);
	});
	process.on('uncaughtException', async (error) => {
		logger.crit(`Caught uncaught exception. Shutting down.`, error);
		await shutdown();
	});
	process.on('unhandledRejection', async (reason) => {
		logger.crit(`Caught unhandled rejection. Shutting down.`, reason);
		await shutdown();
	});
	process.on('warning', (warning) => {
		logger.warning(`NodeJs process warning.`, warning);
	});

	bootstrapPerformed = true;
}

async function shutdown(): Promise<void> {
	/* STOP API SERVER */
	try {
		await new Promise<void>((resolve, reject) => {
			SERVER.close((err) => (err ? reject(err) : resolve()));
		});

		logger.info('Express server closed');
	} catch (e) {
		logger.error('Failed to close api server.', e);
	}

	/* CLOSE MYSQL CONNECTION */
	try {
		await MySqlClientInstance.shutdown();
		logger.info('Mysql client successful shutdown.');
	} catch (e) {
		logger.error('Failed to shutdown mysql client.', e);
	}

	/* CLOSE REDIS CONNECTION */
	try {
		await RedisClientInstance.disconnect();
		logger.info('Redis client successful disconnect.');
	} catch (e) {
		logger.error('Failed to disconnect redis client.', e);
	}
}

export { bootstrap };

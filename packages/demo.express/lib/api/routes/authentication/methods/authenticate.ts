import { ExpressRequestAdapter, ExpressResponseAdapter } from '@thermopylae/core.adapter.express';
import { HttpStatusCode, ObjMap, Mutable, Library, CoreModule } from '@thermopylae/core.declarations';
import { ErrorCodes as CoreUserSessionCommonsErrorCodes } from '@thermopylae/core.user-session.commons';
import { ValidationError } from '@thermopylae/lib.api-validator';
import { AccountWithTotpSecret, AuthenticationContext, ErrorCodes as AuthenticationErrorCodes } from '@thermopylae/lib.authentication';
import { Exception } from '@thermopylae/lib.exception';
import handler from 'express-async-handler';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import farmhash from 'farmhash';
import { ApplicationServices, ServiceMethod } from '../../../../constants';
import { logger } from '../../../../logger';
import { createException, ErrorCodes as AppErrorCodes } from '../../../../error';
import { API_VALIDATOR, AUTHENTICATION_ENGINE, JWT_USER_SESSION_MIDDLEWARE } from '../../../../app/singletons';
import { stringifyOperationContext } from '../../../../utils';

const enum ErrorCodes {
	INVALID_INPUT = 'INVALID_INPUT',
	TOO_MANY_SESSIONS = 'TOO_MANY_SESSIONS'
}

interface RequestBody {
	username: string;
	password?: string;
	'2fa-token'?: string;
	recaptcha?: string;
}

interface ResponseBody {
	account?: Omit<AccountWithTotpSecret, 'totpSecret' | 'username' | 'disabledUntil' | 'pubKey' | 'passwordSalt' | 'passwordAlg' | 'passwordHash'>;
	nextStep?: string;
	token?: string;
	error?: {
		code: ErrorCodes | AuthenticationErrorCodes;
		message: string | ObjMap;
	};
}

const validateRequestBody: RequestHandler = handler(
	async (req: Request<ObjMap, ResponseBody, RequestBody>, res: Response<ResponseBody>, next: NextFunction) => {
		try {
			await API_VALIDATOR.validate(ApplicationServices.AUTHENTICATION, ServiceMethod.AUTHENTICATE, req.body);
			next();
		} catch (e) {
			if (e instanceof ValidationError) {
				res.status(HttpStatusCode.BadRequest).send({
					error: {
						code: ErrorCodes.INVALID_INPUT,
						message: API_VALIDATOR.joinErrors(e.errors, 'text')
					}
				});
				return;
			}
			throw e; // idk how to handle it, let it be some server error
		}
	}
);

const route = handler(async (req: Request<ObjMap, ResponseBody, RequestBody>, res: Response<ResponseBody>) => {
	const request = new ExpressRequestAdapter(req);
	const response = new ExpressResponseAdapter(res);

	const authContext = request.body as Mutable<AuthenticationContext>;
	authContext.ip = request.ip;
	authContext.location = request.location;
	authContext.device = request.device;
	authContext.deviceId = farmhash.hash64(request.header('user-agent') as string);

	try {
		const authenticationStatus = await AUTHENTICATION_ENGINE.authenticate(authContext);

		if (authenticationStatus.authenticated != null) {
			await JWT_USER_SESSION_MIDDLEWARE.create(request, response, {}, { subject: authenticationStatus.authenticated.id });
			logger.info(`Created new user session for account with id '${authenticationStatus.authenticated.id}'.`);

			delete (authenticationStatus.authenticated as Partial<AccountWithTotpSecret>).totpSecret;
			delete (authenticationStatus.authenticated as Partial<AccountWithTotpSecret>).username;
			delete (authenticationStatus.authenticated as Partial<AccountWithTotpSecret>).disabledUntil;
			delete (authenticationStatus.authenticated as Partial<AccountWithTotpSecret>).pubKey;
			delete (authenticationStatus.authenticated as Partial<AccountWithTotpSecret>).passwordSalt;
			delete (authenticationStatus.authenticated as Partial<AccountWithTotpSecret>).passwordAlg;
			delete (authenticationStatus.authenticated as Partial<AccountWithTotpSecret>).passwordHash;

			res.status(HttpStatusCode.Ok).send({ account: authenticationStatus.authenticated });
			return;
		}

		if (authenticationStatus.nextStep) {
			if (authenticationStatus.error && authenticationStatus.error.soft) {
				logger.error(`Authentication failed. ${stringifyOperationContext(authContext)}`, authenticationStatus.error.soft);

				res.status(HttpStatusCode.Unauthorized).send({
					nextStep: authenticationStatus.nextStep,
					error: {
						code: authenticationStatus.error.soft.code as AuthenticationErrorCodes,
						message: 'Authentication error.'
					}
				});
				return;
			}

			res.status(HttpStatusCode.Accepted).send({ nextStep: authenticationStatus.nextStep, token: authenticationStatus.token });
			return;
		}

		if (authenticationStatus.error && authenticationStatus.error.hard) {
			logger.error(`Authentication failed. ${stringifyOperationContext(authContext)}`, authenticationStatus.error.hard);

			if (authenticationStatus.error.hard.code === AuthenticationErrorCodes.ACCOUNT_DISABLED) {
				res.status(HttpStatusCode.Locked).send({
					error: {
						code: AuthenticationErrorCodes.ACCOUNT_DISABLED,
						message: 'Authentication on disable.'
					}
				});
			} else {
				res.status(HttpStatusCode.Gone).send();
			}

			return;
		}

		throw createException(
			AppErrorCodes.MISCONFIGURATION,
			`Authentication completed, but it's status couldn't be resolved. Authentication status: ${JSON.stringify(authenticationStatus)}.`
		);
	} catch (e) {
		if (e instanceof Exception) {
			logger.error(`Authentication failed. ${stringifyOperationContext(authContext)}`, e);

			if (e.emitter === Library.AUTHENTICATION) {
				if (e.code === AuthenticationErrorCodes.ACCOUNT_DISABLED) {
					res.status(HttpStatusCode.Locked).send({
						error: {
							code: AuthenticationErrorCodes.ACCOUNT_DISABLED,
							message: 'Authentication on disable.'
						}
					});
					return;
				}

				if (e.code === AuthenticationErrorCodes.ACCOUNT_NOT_FOUND) {
					res.status(HttpStatusCode.BadRequest).send({
						error: {
							code: AuthenticationErrorCodes.INCORRECT_CREDENTIALS,
							message: 'Credentials are not valid.'
						}
					});
					return;
				}

				if (e.code === AuthenticationErrorCodes.TWO_FACTOR_AUTH_TOKEN_ISSUED_ALREADY) {
					res.status(HttpStatusCode.BadRequest).send({
						error: {
							code: AuthenticationErrorCodes.TWO_FACTOR_AUTH_TOKEN_ISSUED_ALREADY,
							message: 'Two factor authentication token was issued already. Provide it or wait until it expires, then request a new one.'
						}
					});
					return;
				}
			}

			if (e.emitter === CoreModule.USER_SESSION_COMMONS && e.code === CoreUserSessionCommonsErrorCodes.TOO_MANY_CONCURRENT_USER_SESSIONS) {
				res.status(HttpStatusCode.BadRequest).send({
					error: {
						code: ErrorCodes.TOO_MANY_SESSIONS,
						message: 'Concurrent user sessions limit reached.'
					}
				});
				return;
			}
		}

		throw e; // treat as ServerError
	}
});

export { validateRequestBody, route };

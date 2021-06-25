import { ExpressRequestAdapter, ExpressResponseAdapter } from '@thermopylae/core.adapter.express';
import { HttpStatusCode, ObjMap, Mutable, Library, ErrorCodes as CoreErrorCodes } from '@thermopylae/core.declarations';
import { ValidationError } from '@thermopylae/lib.api-validator';
import { AccountWithTotpSecret, AuthenticationContext, ErrorCodes as AuthenticationErrorCodes } from '@thermopylae/lib.authentication';
import { Exception } from '@thermopylae/lib.exception';
import handler from 'express-async-handler';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import farmhash from 'farmhash';
import { SERVICE_NAME, ServiceMethod } from '../../app/constants';
import { logger } from '../../logger';
import { createException } from '../../error';
import { API_VALIDATOR, AUTHENTICATION_ENGINE, JWT_USER_SESSION_MIDDLEWARE } from '../../app/singletons';

const enum ErrorCodes {
	ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
	INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
	INVALID_INPUT = 'INVALID_INPUT',
	RECAPTCHA_THRESHOLD_REACHED = 'RECAPTCHA_THRESHOLD_REACHED',
	TWO_FACTOR_AUTH_TOKEN_ISSUED_ALREADY = 'TWO_FACTOR_AUTH_TOKEN_ISSUED_ALREADY'
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
		code: ErrorCodes;
		message: string | ObjMap;
	};
}

const validateRequestBody: RequestHandler = handler(
	async (req: Request<ObjMap, ResponseBody, RequestBody>, res: Response<ResponseBody>, next: NextFunction) => {
		try {
			await API_VALIDATOR.validate(SERVICE_NAME, ServiceMethod.AUTHENTICATE, req.body);
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
				logger.error(`Authentication failed. Context: ${JSON.stringify(authContext)}.`, authenticationStatus.error.soft);

				res.status(HttpStatusCode.Unauthorized).send({
					nextStep: authenticationStatus.nextStep,
					error: {
						code:
							authenticationStatus.error.soft.code === AuthenticationErrorCodes.RECAPTCHA_THRESHOLD_REACHED
								? ErrorCodes.RECAPTCHA_THRESHOLD_REACHED
								: ErrorCodes.INVALID_CREDENTIALS,
						message: 'Authentication error.'
					}
				});
				return;
			}

			res.status(HttpStatusCode.Accepted).send({ nextStep: authenticationStatus.nextStep, token: authenticationStatus.token });
			return;
		}

		if (authenticationStatus.error && authenticationStatus.error.hard) {
			logger.error(`Authentication failed. Context: ${JSON.stringify(authContext)}.`, authenticationStatus.error.hard);

			if (authenticationStatus.error.hard.code === AuthenticationErrorCodes.ACCOUNT_DISABLED) {
				res.status(HttpStatusCode.Locked).send({
					error: {
						code: ErrorCodes.ACCOUNT_DISABLED,
						message: 'Authentication on disable.'
					}
				});
			} else {
				res.status(HttpStatusCode.Gone).send();
			}

			return;
		}

		throw createException(
			CoreErrorCodes.MISCONFIGURATION,
			`Authentication completed, but it's status couldn't be resolved. Authentication status: ${JSON.stringify(authenticationStatus)}.`
		);
	} catch (e) {
		if (e instanceof Exception && e.emitter === Library.AUTHENTICATION) {
			logger.error(`Authentication failed. Context: ${JSON.stringify(authContext)}.`, e);

			if (e.code === AuthenticationErrorCodes.ACCOUNT_DISABLED) {
				res.status(HttpStatusCode.Locked).send({
					error: {
						code: ErrorCodes.ACCOUNT_DISABLED,
						message: 'Authentication on disable.'
					}
				});
				return;
			}

			if (e.code === AuthenticationErrorCodes.ACCOUNT_NOT_FOUND) {
				res.status(HttpStatusCode.BadRequest).send({
					error: {
						code: ErrorCodes.INVALID_CREDENTIALS,
						message: 'Credentials are not valid.'
					}
				});
				return;
			}

			if (e.code === AuthenticationErrorCodes.TWO_FACTOR_AUTH_TOKEN_ISSUED_ALREADY) {
				res.status(HttpStatusCode.BadRequest).send({
					error: {
						code: ErrorCodes.TWO_FACTOR_AUTH_TOKEN_ISSUED_ALREADY,
						message: 'Two factor authentication token was issued already. Provide it or wait until it expires, then request a new one.'
					}
				});
				return;
			}
		}

		throw e; // treat as ServerError
	}
});

export { validateRequestBody, route };

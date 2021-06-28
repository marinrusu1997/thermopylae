import { NextFunction, Request, RequestHandler, Response } from 'express';
import handler from 'express-async-handler';
import { HttpStatusCode, Library, ObjMap, PartialSome } from '@thermopylae/core.declarations';
import { ValidationError } from '@thermopylae/lib.api-validator';
import { AccountStatus, AccountToBeRegistered, AccountWithTotpSecret, ErrorCodes as AuthenticationErrorCodes } from '@thermopylae/lib.authentication';
import { Exception } from '@thermopylae/lib.exception';
import { publicEncrypt } from 'crypto';
import { API_VALIDATOR, AUTHENTICATION_ENGINE } from '../../../../app/singletons';
import { SERVICE_NAME, ServiceMethod } from '../../../../app/constants';
import { logger } from '../../../../logger';

const enum ErrorCodes {
	INVALID_INPUT = 'INVALID_INPUT'
}

interface RequestBody {
	username: string;
	password: string;
	email: string;
	telephone: string;
	pubKey?: string;
}

interface ResponseBody {
	error?: {
		code: ErrorCodes | AuthenticationErrorCodes;
		message: string | ObjMap;
	};
}

const PUBLIC_KEY_TEST_BUFFER = Buffer.from('1');

const validateRequestBody: RequestHandler = handler(
	async (req: Request<ObjMap, ResponseBody, RequestBody>, res: Response<ResponseBody>, next: NextFunction) => {
		try {
			await API_VALIDATOR.validate(SERVICE_NAME, ServiceMethod.REGISTER, req.body);
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
			throw e;
		}

		try {
			if (req.body.pubKey != null) {
				publicEncrypt(req.body.pubKey, PUBLIC_KEY_TEST_BUFFER); // @fixme use validator from auth engine
			}
			next();
		} catch (e) {
			logger.error('Failed to validate public key while registering account.', e);

			res.status(HttpStatusCode.BadRequest).send({
				error: {
					code: ErrorCodes.INVALID_INPUT,
					message: 'pubKey is not valid'
				}
			});
		}
	}
);

const route = handler(async (req: Request<ObjMap, ResponseBody, RequestBody>, res: Response<ResponseBody>) => {
	const account = req.body as unknown as AccountToBeRegistered<AccountWithTotpSecret>;

	account.disabledUntil = AccountStatus.DISABLED_UNTIL_ACTIVATION;
	account.passwordHash = req.body.password;
	delete (req.body as PartialSome<RequestBody, 'password'>).password;

	try {
		await AUTHENTICATION_ENGINE.register(account);
		res.status(HttpStatusCode.Created).send();
	} catch (e) {
		if (e instanceof Exception && e.emitter === Library.AUTHENTICATION) {
			if (e.code === AuthenticationErrorCodes.WEAK_PASSWORD) {
				res.status(HttpStatusCode.BadRequest).send({
					error: {
						code: e.code,
						message: e.message
					}
				});
				return;
			}

			if (e.code === AuthenticationErrorCodes.ACCOUNT_WITH_DUPLICATED_FIELDS) {
				res.status(HttpStatusCode.Conflict).send({
					error: {
						code: e.code,
						message: e.origin
					}
				});
				return;
			}
		}
		throw e;
	}
});

export { validateRequestBody, route };

import { HttpStatusCode, Library, type ObjMap, type PartialSome } from '@thermopylae/core.declarations';
import { ValidationError } from '@thermopylae/lib.api-validator';
import { AccountStatus, type AccountToBeRegistered, type AccountWithTotpSecret, ErrorCodes as AuthenticationErrorCodes } from '@thermopylae/lib.authentication';
import { Exception } from '@thermopylae/lib.exception';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import handler from 'express-async-handler';
import { publicEncrypt } from 'node:crypto';
import { API_VALIDATOR, AUTHENTICATION_ENGINE } from '../../../../app/singletons.js';
import { ApplicationServices, ServiceMethod } from '../../../../constants.js';
import { logger } from '../../../../logger.js';

enum ErrorCodes {
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
			await API_VALIDATOR.validate(ApplicationServices.AUTHENTICATION, ServiceMethod.REGISTER, req.body);
		} catch (error) {
			// @ts-expect-error error
			if (error instanceof ValidationError) {
				res.status(HttpStatusCode.BadRequest).send({
					error: {
						code: ErrorCodes.INVALID_INPUT,
						message: API_VALIDATOR.joinErrors(error.errors, 'text')
					}
				});
				return;
			}
			throw error;
		}

		try {
			if (req.body.pubKey != null) {
				publicEncrypt(req.body.pubKey, PUBLIC_KEY_TEST_BUFFER); // @fixme use validator from auth engine
			}
			next();
		} catch (error) {
			logger.error('Failed to validate public key while registering account.', error);

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
	} catch (error) {
		if (error instanceof Exception && error.emitter === Library.AUTHENTICATION) {
			if (error.code === AuthenticationErrorCodes.WEAK_PASSWORD) {
				res.status(HttpStatusCode.BadRequest).send({
					error: {
						code: error.code,
						message: error.message
					}
				});
				return;
			}

			if (error.code === AuthenticationErrorCodes.ACCOUNT_WITH_DUPLICATED_FIELDS) {
				res.status(HttpStatusCode.Conflict).send({
					error: {
						code: error.code,
						message: error.message
					}
				});
				return;
			}
		}
		throw error;
	}
});

export { validateRequestBody, route };

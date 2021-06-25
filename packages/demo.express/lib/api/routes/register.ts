import { NextFunction, Request, RequestHandler, Response } from 'express';
import handler from 'express-async-handler';
import { HttpStatusCode, Library, ObjMap, PartialSome } from '@thermopylae/core.declarations';
import { ValidationError } from '@thermopylae/lib.api-validator';
import { AccountStatus, AccountToBeRegistered, AccountWithTotpSecret, ErrorCodes as AuthenticationErrorCodes } from '@thermopylae/lib.authentication';
import { Exception } from '@thermopylae/lib.exception';
import { API_VALIDATOR, AUTHENTICATION_ENGINE } from '../../app/singletons';
import { SERVICE_NAME, ServiceMethod } from '../../app/constants';

const enum ErrorCodes {
	INVALID_INPUT = 'INVALID_INPUT',
	WEAK_PASSWORD = 'WEAK_PASSWORD'
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
		code: ErrorCodes;
		message: string | ObjMap;
	};
}

const validateRequestBody: RequestHandler = handler(
	async (req: Request<ObjMap, ResponseBody, RequestBody>, res: Response<ResponseBody>, next: NextFunction) => {
		try {
			await API_VALIDATOR.validate(SERVICE_NAME, ServiceMethod.REGISTER, req.body);
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
			throw e;
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
		if (e instanceof Exception && e.emitter === Library.AUTHENTICATION && e.code === AuthenticationErrorCodes.WEAK_PASSWORD) {
			res.status(HttpStatusCode.BadRequest).send({
				error: {
					code: ErrorCodes.WEAK_PASSWORD,
					message: e.message
				}
			});
			return;
		}
		throw e;
	}
});

export { validateRequestBody, route };

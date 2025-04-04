import { HttpStatusCode, Library, type ObjMap, type RequireAtLeastOne } from '@thermopylae/core.declarations';
import { ValidationError } from '@thermopylae/lib.api-validator';
import { ErrorCodes as AuthenticationErrorCodes } from '@thermopylae/lib.authentication';
import { Exception } from '@thermopylae/lib.exception';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import handler from 'express-async-handler';
import { API_VALIDATOR, AUTHENTICATION_ENGINE } from '../../../../app/singletons.js';
import { ApplicationServices, ServiceMethod } from '../../../../constants.js';
import { logger } from '../../../../logger.js';

const enum ErrorCodes {
	INVALID_INPUT = 'INVALID_INPUT'
}

type RequestBody = RequireAtLeastOne<
	{
		username?: string;
		email?: string;
		telephone?: string;
		sendTokenVia: 'sms' | 'email';
	},
	'username' | 'email' | 'telephone'
>;

interface ResponseBody {
	error?: {
		code: ErrorCodes | AuthenticationErrorCodes;
		message: string | ObjMap;
	};
}

const validateRequestBody: RequestHandler = handler(
	async (req: Request<ObjMap, ResponseBody, RequestBody>, res: Response<ResponseBody>, next: NextFunction) => {
		try {
			await API_VALIDATOR.validate(ApplicationServices.AUTHENTICATION, ServiceMethod.CREATE_FORGOT_PASSWORD_SESSION, req.body);
			next();
		} catch (e) {
			// @ts-ignore
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
	let readByField: 'readByUsername' | 'readByEmail' | 'readByTelephone' = null!;
	let readByValue: string = null!;

	if (req.body.username != null) {
		readByField = 'readByUsername';
		readByValue = req.body.username;
	} else if (req.body.email != null) {
		readByField = 'readByEmail';
		readByValue = req.body.email;
	} else if (req.body.telephone != null) {
		readByField = 'readByTelephone';
		readByValue = req.body.telephone;
	}

	try {
		const account = await AUTHENTICATION_ENGINE.createForgotPasswordSession(readByField, readByValue, req.body.sendTokenVia);
		logger.info(`Created forgot password session for account with id '${account.id}'.`);

		res.status(HttpStatusCode.Accepted).send();
	} catch (e) {
		if (e instanceof Exception && e.emitter === Library.AUTHENTICATION) {
			logger.error(`Create forgot password session failed. Request origin: ${req.ip}.`, e);
			res.status(HttpStatusCode.Accepted).send();
			return;
		}

		throw e;
	}
});

export { validateRequestBody, route };

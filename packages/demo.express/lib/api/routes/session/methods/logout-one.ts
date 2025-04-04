import { HttpStatusCode, type ObjMap } from '@thermopylae/core.declarations';
import { ValidationError } from '@thermopylae/lib.api-validator';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import handler from 'express-async-handler';
import { API_VALIDATOR, JWT_USER_SESSION_MIDDLEWARE } from '../../../../app/singletons.js';
import { ApplicationServices, REQUEST_USER_SESSION_SYM, ServiceMethod } from '../../../../constants.js';
import { ErrorCodes as AppErrorCodes, createException } from '../../../../error.js';
import type { RequestWithUserSession } from '../../../../typings.js';

enum ErrorCodes {
	INVALID_INPUT = 'INVALID_INPUT'
}

interface RequestBody {
	'refresh-token': string;
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
			await API_VALIDATOR.validate(ApplicationServices.AUTHENTICATION, ServiceMethod.LOGOUT_ONE, req.body);
			next();
		} catch (error) {
			// @ts-expect-error-error
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
	}
);

const route = handler(async (req: RequestWithUserSession<ObjMap, ResponseBody, RequestBody>, res: Response<ResponseBody>) => {
	const userSession = req[REQUEST_USER_SESSION_SYM];
	if (!userSession) {
		throw createException(AppErrorCodes.MISCONFIGURATION, 'Request is missing user session');
	}

	await JWT_USER_SESSION_MIDDLEWARE.sessionManager.deleteOne(userSession.sub, req.body['refresh-token']);
	res.status(HttpStatusCode.NoContent).send();
});

export { route, validateRequestBody };

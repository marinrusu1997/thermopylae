import { NextFunction, Request, RequestHandler, Response } from 'express';
import handler from 'express-async-handler';
import { HttpStatusCode, Library, ObjMap } from '@thermopylae/core.declarations';
import { ValidationError } from '@thermopylae/lib.api-validator';
import { ErrorCodes as AuthenticationErrorCodes } from '@thermopylae/lib.authentication';
import { Exception } from '@thermopylae/lib.exception';
import { API_VALIDATOR, AUTHENTICATION_ENGINE } from '../../../../app/singletons';
import { ApplicationServices, ServiceMethod } from '../../../../constants';
import { logger } from '../../../../logger';
import { createException, ErrorCodes as AppErrorCodes } from '../../../../error';

const enum ErrorCodes {
	INVALID_INPUT = 'INVALID_INPUT'
}

interface RequestBody {
	token: string;
	newPassword: string;
}

interface ResponseBody {
	error?: {
		code: ErrorCodes | AuthenticationErrorCodes;
		message: string | ObjMap;
	};
}

const validateRequestBody: RequestHandler = handler(
	async (req: Request<ObjMap, ResponseBody, RequestBody>, res: Response<ResponseBody>, next: NextFunction) => {
		try {
			await API_VALIDATOR.validate(ApplicationServices.AUTHENTICATION, ServiceMethod.CHANGE_FORGOTTEN_PASSWORD, req.body);
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
	try {
		await AUTHENTICATION_ENGINE.changeForgottenPassword(req.body.token, req.body.newPassword);
		res.status(HttpStatusCode.NoContent).send();
	} catch (e) {
		if (e instanceof Exception && e.emitter === Library.AUTHENTICATION) {
			logger.error(`Change forgotten password failed. Request origin: ${req.ip}.`, e);

			let httpResponseStatus: number;
			switch (e.code) {
				case AuthenticationErrorCodes.ACCOUNT_NOT_FOUND:
					httpResponseStatus = HttpStatusCode.NotFound;
					break;
				case AuthenticationErrorCodes.ACCOUNT_DISABLED:
					httpResponseStatus = HttpStatusCode.Gone;
					break;
				case AuthenticationErrorCodes.SESSION_NOT_FOUND:
					httpResponseStatus = HttpStatusCode.NotFound;
					break;
				case AuthenticationErrorCodes.WEAK_PASSWORD:
					httpResponseStatus = HttpStatusCode.BadRequest;
					break;
				default:
					throw createException(
						AppErrorCodes.MISCONFIGURATION,
						`Could not determine http response code from Exception thrown by AuthenticationEngine.changeForgottenPassword method. Error code: ${e.code}.`
					);
			}

			res.status(httpResponseStatus).send({
				error: {
					code: e.code,
					message: 'Change forgotten password failed.'
				}
			});
			return;
		}

		throw e;
	}
});

export { validateRequestBody, route };

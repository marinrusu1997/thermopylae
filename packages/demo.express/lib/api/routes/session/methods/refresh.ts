import handler from 'express-async-handler';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ExpressRequestAdapter, ExpressResponseAdapter } from '@thermopylae/core.adapter.express';
import { HttpStatusCode, ObjMap, CoreModule, ErrorCodes as CoreErrorCodes, Library } from '@thermopylae/core.declarations';
import { Exception } from '@thermopylae/lib.exception';
import { ValidationError } from '@thermopylae/lib.api-validator';
import { API_VALIDATOR, JWT_USER_SESSION_MIDDLEWARE } from '../../../../app/singletons';
import { SERVICE_NAME, ServiceMethod } from '../../../../app/constants';

const enum ErrorCodes {
	AUTHENTICATION_DEVICE_MISMATCH = 'AUTHENTICATION_DEVICE_MISMATCH',
	INVALID_INPUT = 'INVALID_INPUT',
	INVALID_REFRESH_TOKEN = 'INVALID_REFRESH_TOKEN',
	REFRESH_TOKEN_REQUIRED = 'REFRESH_TOKEN_REQUIRED',
	CSRF_HEADER_REQUIRED = 'CSRF_HEADER_REQUIRED'
}

interface RequestBody {
	accountId: string;
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
			await API_VALIDATOR.validate(SERVICE_NAME, ServiceMethod.REFRESH_USER_SESSION, req.body);
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
	const request = new ExpressRequestAdapter(req);
	const response = new ExpressResponseAdapter(res);

	try {
		await JWT_USER_SESSION_MIDDLEWARE.refresh(request, response, {}, { subject: req.body.accountId });
		res.status(HttpStatusCode.NoContent).send();
	} catch (e) {
		if (e instanceof Exception) {
			if (e.emitter === CoreModule.JWT_USER_SESSION) {
				if (e.code === CoreErrorCodes.NOT_FOUND) {
					res.status(HttpStatusCode.BadRequest).send({
						error: {
							code: ErrorCodes.REFRESH_TOKEN_REQUIRED,
							message: 'Refresh token is required for session renew.'
						}
					});
					return;
				}

				if (e.code === CoreErrorCodes.CHECK_FAILED) {
					res.status(HttpStatusCode.BadRequest).send({
						error: {
							code: ErrorCodes.CSRF_HEADER_REQUIRED,
							message: 'Correct value of the CSRF header is required for session renew.'
						}
					});
					return;
				}
			}

			if (e.emitter === Library.JWT_USER_SESSION) {
				if (e.code === CoreErrorCodes.NOT_FOUND) {
					res.status(HttpStatusCode.NotFound).send({
						error: {
							code: ErrorCodes.INVALID_REFRESH_TOKEN,
							message: 'Refresh token is not valid.'
						}
					});
					return;
				}

				if (e.code === CoreErrorCodes.NOT_EQUAL) {
					res.status(HttpStatusCode.BadRequest).send({
						error: {
							code: ErrorCodes.AUTHENTICATION_DEVICE_MISMATCH,
							message: 'Refresh needs to be made from same device used at session creation.'
						}
					});
					return;
				}
			}
		}

		throw e;
	}
});

export { validateRequestBody, route };

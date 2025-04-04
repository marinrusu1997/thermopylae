import { ExpressRequestAdapter, ExpressResponseAdapter } from '@thermopylae/core.adapter.express';
import { HttpStatusCode, Library, type Mutable, type ObjMap } from '@thermopylae/core.declarations';
import { ValidationError } from '@thermopylae/lib.api-validator';
import { ErrorCodes as AuthenticationErrorCodes, type ChangePasswordContext } from '@thermopylae/lib.authentication';
import { Exception } from '@thermopylae/lib.exception';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import handler from 'express-async-handler';
import { API_VALIDATOR, AUTHENTICATION_ENGINE, JWT_USER_SESSION_MIDDLEWARE } from '../../../../app/singletons.js';
import { ApplicationServices, REQUEST_USER_SESSION_SYM, ServiceMethod } from '../../../../constants.js';
import { ErrorCodes as AppErrorCodes, createException } from '../../../../error.js';
import { logger } from '../../../../logger.js';
import type { RequestWithUserSession } from '../../../../typings.js';
import { stringifyOperationContext } from '../../../../utils.js';

enum ErrorCodes {
	INVALID_INPUT = 'INVALID_INPUT'
}

interface RequestBody {
	oldPassword: string;
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
			await API_VALIDATOR.validate(ApplicationServices.AUTHENTICATION, ServiceMethod.CHANGE_PASSWORD, req.body);
			next();
		} catch (error) {
			// @ts-expect-error  error
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
	const request = new ExpressRequestAdapter(req);
	const response = new ExpressResponseAdapter(res);

	const context = request.body as Mutable<ChangePasswordContext>;
	context.ip = request.ip;
	context.location = request.location;
	context.device = request.device;

	const userSession = req[REQUEST_USER_SESSION_SYM];
	if (!userSession) {
		throw createException(AppErrorCodes.MISCONFIGURATION, 'Request is missing user session');
	}
	context.accountId = userSession.sub;

	try {
		await AUTHENTICATION_ENGINE.changePassword(context);
		JWT_USER_SESSION_MIDDLEWARE.unsetSessionCookies(request, response);
		res.status(HttpStatusCode.NoContent).send();
	} catch (error) {
		if (error instanceof Exception && error.emitter === Library.AUTHENTICATION) {
			logger.error(`Change password failed. ${stringifyOperationContext(context)}`, error);

			let httpResponseStatus = -1;
			switch (error.code) {
				case AuthenticationErrorCodes.ACCOUNT_NOT_FOUND:
					httpResponseStatus = HttpStatusCode.NotFound;
					break;
				case AuthenticationErrorCodes.ACCOUNT_DISABLED:
					httpResponseStatus = HttpStatusCode.Gone;
					break;
				case AuthenticationErrorCodes.INCORRECT_PASSWORD:
				case AuthenticationErrorCodes.SIMILAR_PASSWORDS:
				case AuthenticationErrorCodes.WEAK_PASSWORD:
					httpResponseStatus = HttpStatusCode.BadRequest;
					break;
				default:
					throw createException(
						AppErrorCodes.MISCONFIGURATION,
						`Could not determine http response code from Exception thrown by AuthenticationEngine.changePassword method. Error code: ${error.code}.`
					);
			}

			res.status(httpResponseStatus).send({
				error: {
					code: error.code,
					message: 'Change password failed.'
				}
			});
			return;
		}

		throw error;
	}
});

export { validateRequestBody, route };

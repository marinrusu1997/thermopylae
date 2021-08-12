import { HttpStatusCode, Library, Mutable, ObjMap } from '@thermopylae/core.declarations';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import handler from 'express-async-handler';
import { ValidationError } from '@thermopylae/lib.api-validator';
import { ExpressRequestAdapter, ExpressResponseAdapter } from '@thermopylae/core.adapter.express';
import { ChangePasswordContext, ErrorCodes as AuthenticationErrorCodes } from '@thermopylae/lib.authentication';
import { Exception } from '@thermopylae/lib.exception';
import { API_VALIDATOR, AUTHENTICATION_ENGINE, JWT_USER_SESSION_MIDDLEWARE } from '../../../../app/singletons';
import { REQUEST_USER_SESSION_SYM, ApplicationServices, ServiceMethod } from '../../../../constants';
import { logger } from '../../../../logger';
import { createException, ErrorCodes as AppErrorCodes } from '../../../../error';
import { RequestWithUserSession } from '../../../../typings';
import { stringifyOperationContext } from '../../../../utils';

const enum ErrorCodes {
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

const route = handler(async (req: RequestWithUserSession<ObjMap, ResponseBody, RequestBody>, res: Response<ResponseBody>) => {
	const request = new ExpressRequestAdapter(req);
	const response = new ExpressResponseAdapter(res);

	const context = request.body as Mutable<ChangePasswordContext>;
	context.ip = request.ip;
	context.location = request.location;
	context.device = request.device;
	context.accountId = req[REQUEST_USER_SESSION_SYM]!.sub;

	try {
		await AUTHENTICATION_ENGINE.changePassword(context);
		JWT_USER_SESSION_MIDDLEWARE.unsetSessionCookies(request, response);
		res.status(HttpStatusCode.NoContent).send();
	} catch (e) {
		if (e instanceof Exception && e.emitter === Library.AUTHENTICATION) {
			logger.error(`Change password failed. ${stringifyOperationContext(context)}`, e);

			let httpResponseStatus: number;
			switch (e.code) {
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
						`Could not determine http response code from Exception thrown by AuthenticationEngine.changePassword method. Error code: ${e.code}.`
					);
			}

			res.status(httpResponseStatus).send({
				error: {
					code: e.code,
					message: 'Change password failed.'
				}
			});
			return;
		}

		throw e;
	}
});

export { validateRequestBody, route };

import { ExpressRequestAdapter } from '@thermopylae/core.adapter.express';
import { HttpStatusCode, Library, type Mutable, type ObjMap } from '@thermopylae/core.declarations';
import { ValidationError } from '@thermopylae/lib.api-validator';
import {
	ErrorCodes as AuthenticationErrorCodes,
	type OnTwoFactorEnabledHookResult,
	type SetTwoFactorAuthenticationContext
} from '@thermopylae/lib.authentication';
import { Exception } from '@thermopylae/lib.exception';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import handler from 'express-async-handler';
import { API_VALIDATOR, AUTHENTICATION_ENGINE } from '../../../../app/singletons.js';
import { ApplicationServices, REQUEST_USER_SESSION_SYM, ServiceMethod } from '../../../../constants.js';
import { ErrorCodes as AppErrorCodes, createException } from '../../../../error.js';
import { logger } from '../../../../logger.js';
import type { RequestWithUserSession } from '../../../../typings.js';
import { stringifyOperationContext } from '../../../../utils.js';

enum ErrorCodes {
	INVALID_INPUT = 'INVALID_INPUT'
}

interface RequestBody {
	enabled: boolean;
	password: string;
}

interface ResponseBody extends Partial<OnTwoFactorEnabledHookResult> {
	error?: {
		code: ErrorCodes | AuthenticationErrorCodes;
		message: string | ObjMap;
	};
}

const validateRequestBody: RequestHandler = handler(
	async (req: Request<ObjMap, ResponseBody, RequestBody>, res: Response<ResponseBody>, next: NextFunction) => {
		try {
			await API_VALIDATOR.validate(ApplicationServices.AUTHENTICATION, ServiceMethod.SET_TWO_FACTOR_AUTH_ENABLED, req.body);
			next();
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
	}
);

const route = handler(async (req: RequestWithUserSession<ObjMap, ResponseBody, RequestBody>, res: Response<ResponseBody>) => {
	const request = new ExpressRequestAdapter(req);

	const context = request.body as Mutable<SetTwoFactorAuthenticationContext>;
	context.ip = request.ip;
	context.location = request.location;
	context.device = request.device;

	const userSession = req[REQUEST_USER_SESSION_SYM];
	if (!userSession) {
		throw createException(AppErrorCodes.MISCONFIGURATION, 'Request is missing user session');
	}

	try {
		const result = (await AUTHENTICATION_ENGINE.setTwoFactorAuthEnabled(userSession.sub, req.body.enabled, context)) as
			| OnTwoFactorEnabledHookResult
			| null
			| undefined;

		if (result == null) {
			res.status(HttpStatusCode.NoContent).send();
		} else {
			res.status(HttpStatusCode.Ok).send(result);
		}
	} catch (error) {
		if (error instanceof Exception && error.emitter === Library.AUTHENTICATION) {
			logger.error(`Set two factor authentication enabled failed. ${stringifyOperationContext(context)}.`, error);

			let httpResponseStatus = -1;
			switch (error.code) {
				case AuthenticationErrorCodes.ACCOUNT_NOT_FOUND:
					httpResponseStatus = HttpStatusCode.NotFound;
					break;
				case AuthenticationErrorCodes.ACCOUNT_DISABLED:
					httpResponseStatus = HttpStatusCode.Gone;
					break;
				case AuthenticationErrorCodes.INCORRECT_PASSWORD:
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
					message: 'Set two factor authentication enabled failed.'
				}
			});
			return;
		}

		throw error;
	}
});

export { validateRequestBody, route };

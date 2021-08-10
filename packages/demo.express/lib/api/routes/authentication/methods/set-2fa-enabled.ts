import { HttpStatusCode, Library, Mutable, ObjMap } from '@thermopylae/core.declarations';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import handler from 'express-async-handler';
import { ValidationError } from '@thermopylae/lib.api-validator';
import { ExpressRequestAdapter } from '@thermopylae/core.adapter.express';
import { SetTwoFactorAuthenticationContext, ErrorCodes as AuthenticationErrorCodes, OnTwoFactorEnabledHookResult } from '@thermopylae/lib.authentication';
import { Exception } from '@thermopylae/lib.exception';
import { API_VALIDATOR, AUTHENTICATION_ENGINE } from '../../../../app/singletons';
import { logger } from '../../../../logger';
import { REQUEST_SESSION_SYM, SERVICE_NAME, ServiceMethod } from '../../../../app/constants';
import { createException, ErrorCodes as AppErrorCodes } from '../../../../error';
import { RequestWithUserSession } from '../../../../typings';
import { stringifyOperationContext } from '../../../../utils';

const enum ErrorCodes {
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
			await API_VALIDATOR.validate(SERVICE_NAME, ServiceMethod.SET_TWO_FACTOR_AUTH_ENABLED, req.body);
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

	const context = request.body as Mutable<SetTwoFactorAuthenticationContext>;
	context.ip = request.ip;
	context.location = request.location;
	context.device = request.device;

	try {
		const result = (await AUTHENTICATION_ENGINE.setTwoFactorAuthEnabled(req[REQUEST_SESSION_SYM]!.sub, req.body.enabled, context)) as
			| OnTwoFactorEnabledHookResult
			| null
			| undefined;

		if (result != null) {
			res.status(HttpStatusCode.Ok).send(result);
		} else {
			res.status(HttpStatusCode.NoContent).send();
		}
	} catch (e) {
		if (e instanceof Exception && e.emitter === Library.AUTHENTICATION) {
			logger.error(`Set two factor authentication enabled failed. ${stringifyOperationContext(context)}.`, e);

			let httpResponseStatus: number;
			switch (e.code) {
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
						`Could not determine http response code from Exception thrown by AuthenticationEngine.changePassword method. Error code: ${e.code}.`
					);
			}

			res.status(httpResponseStatus).send({
				error: {
					code: e.code,
					message: 'Set two factor authentication enabled failed.'
				}
			});
			return;
		}

		throw e;
	}
});

export { validateRequestBody, route };

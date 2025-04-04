import { ExpressRequestAdapter, ExpressResponseAdapter } from '@thermopylae/core.adapter.express';
import { CoreModule, HttpStatusCode, type ObjMap } from '@thermopylae/core.declarations';
import { ErrorCodes as CoreJwtUserSessionErrorCodes } from '@thermopylae/core.jwt-session';
import { Exception } from '@thermopylae/lib.exception';
import type { Response } from 'express';
import handler from 'express-async-handler';
import { JWT_USER_SESSION_MIDDLEWARE } from '../../../../app/singletons.js';
import { REQUEST_USER_SESSION_SYM } from '../../../../constants.js';
import { ErrorCodes as AppErrorCodes, createException } from '../../../../error.js';
import type { RequestWithUserSession } from '../../../../typings.js';

enum ErrorCodes {
	REFRESH_TOKEN_REQUIRED = 'REFRESH_TOKEN_REQUIRED',
	CSRF_HEADER_REQUIRED = 'CSRF_HEADER_REQUIRED'
}

interface ResponseBody {
	error?: {
		code: ErrorCodes;
		message: string | ObjMap;
	};
}

const route = handler(async (req: RequestWithUserSession, res: Response<ResponseBody>) => {
	const request = new ExpressRequestAdapter(req);
	const response = new ExpressResponseAdapter(res);

	const userSession = req[REQUEST_USER_SESSION_SYM];
	if (!userSession) {
		throw createException(AppErrorCodes.MISCONFIGURATION, 'Request is missing user session');
	}

	try {
		await JWT_USER_SESSION_MIDDLEWARE.delete(request, response, userSession.sub, userSession, true);
		res.status(HttpStatusCode.NoContent).send();
	} catch (error) {
		if (error instanceof Exception && error.emitter === CoreModule.JWT_USER_SESSION) {
			if (error.code === CoreJwtUserSessionErrorCodes.REFRESH_TOKEN_NOT_FOUND_IN_THE_REQUEST) {
				res.status(HttpStatusCode.BadRequest).send({
					error: {
						code: ErrorCodes.REFRESH_TOKEN_REQUIRED,
						message: 'Refresh token is required for logout.'
					}
				});
				return;
			}

			if (error.code === CoreJwtUserSessionErrorCodes.CSRF_HEADER_INVALID_VALUE) {
				res.status(HttpStatusCode.BadRequest).send({
					error: {
						code: ErrorCodes.CSRF_HEADER_REQUIRED,
						message: 'Correct value of the CSRF header is required for logout.'
					}
				});
				return;
			}
		}

		throw error;
	}
});

export { route };

import handler from 'express-async-handler';
import { Response } from 'express';
import { ExpressRequestAdapter, ExpressResponseAdapter } from '@thermopylae/core.adapter.express';
import { HttpStatusCode, ObjMap, CoreModule } from '@thermopylae/core.declarations';
import { ErrorCodes as CoreJwtUserSessionErrorCodes } from '@thermopylae/core.jwt-session';
import { Exception } from '@thermopylae/lib.exception';
import { JWT_USER_SESSION_MIDDLEWARE } from '../../../../app/singletons';
import { RequestWithUserSession } from '../../../../typings';
import { REQUEST_SESSION_SYM } from '../../../../app/constants';

const enum ErrorCodes {
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

	try {
		await JWT_USER_SESSION_MIDDLEWARE.delete(request, response, req[REQUEST_SESSION_SYM]!.sub, req[REQUEST_SESSION_SYM]!, true);
		res.status(HttpStatusCode.NoContent).send();
	} catch (e) {
		if (e instanceof Exception) {
			if (e.emitter === CoreModule.JWT_USER_SESSION) {
				if (e.code === CoreJwtUserSessionErrorCodes.REFRESH_TOKEN_NOT_FOUND_IN_THE_REQUEST) {
					res.status(HttpStatusCode.BadRequest).send({
						error: {
							code: ErrorCodes.REFRESH_TOKEN_REQUIRED,
							message: 'Refresh token is required for logout.'
						}
					});
					return;
				}

				if (e.code === CoreJwtUserSessionErrorCodes.CSRF_HEADER_INVALID_VALUE) {
					res.status(HttpStatusCode.BadRequest).send({
						error: {
							code: ErrorCodes.CSRF_HEADER_REQUIRED,
							message: 'Correct value of the CSRF header is required for logout.'
						}
					});
					return;
				}
			}
		}

		throw e;
	}
});

export { route };

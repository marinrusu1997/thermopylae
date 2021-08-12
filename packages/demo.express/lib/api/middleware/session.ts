import { CoreModule, HttpStatusCode, ObjMap, Library } from '@thermopylae/core.declarations';
import { ExpressRequestAdapter, ExpressResponseAdapter } from '@thermopylae/core.adapter.express';
import { ErrorCodes as CoreUserSessionCommonsErrorCodes } from '@thermopylae/core.user-session.commons';
import { JsonWebTokenError, TokenExpiredError, ErrorCodes as LibraryJwtSessionErrorCodes } from '@thermopylae/lib.jwt-user-session';
import { ErrorCodes as CoreJwtSessionErrorCodes } from '@thermopylae/core.jwt-session';
import { Exception } from '@thermopylae/lib.exception';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import unless, { Options } from 'express-unless';
import handler from 'express-async-handler';
import { REQUEST_USER_SESSION_SYM } from '../../constants';
import { logger } from '../../logger';
import { JWT_USER_SESSION_MIDDLEWARE } from '../../app/singletons';

const enum ErrorCodes {
	INVALID_SESSION = 'INVALID_SESSION',
	ACCESS_TOKEN_REQUIRED = 'ACCESS_TOKEN_REQUIRED',
	AUTHORIZATION_HEADER_REQUIRED = 'AUTHORIZATION_HEADER_REQUIRED',
	AUTHORIZATION_HEADER_INVALID_VALUE = 'AUTHORIZATION_HEADER_INVALID_VALUE',
	AUTHORIZATION_HEADER_INVALID_SCHEME = 'AUTHORIZATION_HEADER_INVALID_SCHEME',
	CSRF_HEADER_REQUIRED = 'CSRF_HEADER_REQUIRED'
}

interface ResponseBody {
	error: {
		code: ErrorCodes;
		message: string;
	};
}

function requiresAuthentication(unlessOptions: Options): RequestHandler {
	return unless(
		handler(async (req: Request<ObjMap, ResponseBody>, res: Response<ResponseBody>, next: NextFunction) => {
			try {
				const request = new ExpressRequestAdapter(req);
				const response = new ExpressResponseAdapter(res);

				(req as any)[REQUEST_USER_SESSION_SYM] = await JWT_USER_SESSION_MIDDLEWARE.verify(request, response, undefined, true);

				next();
			} catch (e) {
				if (e instanceof Exception) {
					logger.error('Verify user session failed.', e);

					if (e.emitter === CoreModule.JWT_USER_SESSION) {
						if (e.code === CoreUserSessionCommonsErrorCodes.AUTHORIZATION_HEADER_NOT_FOUND) {
							res.status(HttpStatusCode.BadRequest).send({
								error: {
									code: ErrorCodes.AUTHORIZATION_HEADER_REQUIRED,
									message: e.message
								}
							});
							return;
						}
						if (e.code === CoreUserSessionCommonsErrorCodes.AUTHORIZATION_HEADER_INVALID_SCHEME) {
							res.status(HttpStatusCode.BadRequest).send({
								error: {
									code: ErrorCodes.AUTHORIZATION_HEADER_INVALID_SCHEME,
									message: e.message
								}
							});
							return;
						}
						if (e.code === CoreUserSessionCommonsErrorCodes.AUTHORIZATION_HEADER_HAS_NO_ACCESS_TOKEN) {
							res.status(HttpStatusCode.BadRequest).send({
								error: {
									code: ErrorCodes.ACCESS_TOKEN_REQUIRED,
									message: e.message
								}
							});
							return;
						}

						if (e.code === CoreJwtSessionErrorCodes.CSRF_HEADER_INVALID_VALUE) {
							res.status(HttpStatusCode.BadRequest).send({
								error: {
									code: ErrorCodes.CSRF_HEADER_REQUIRED,
									message: 'Correct value of the CSRF header is required for user session verify.'
								}
							});
							return;
						}
					}

					if (e.emitter === Library.JWT_USER_SESSION && e.code === LibraryJwtSessionErrorCodes.USER_SESSION_NOT_FOUND) {
						res.status(HttpStatusCode.Unauthorized).send({
							error: {
								code: ErrorCodes.INVALID_SESSION,
								message: 'User session is no longer valid.'
							}
						});
						return;
					}
				}

				if (e instanceof TokenExpiredError || e instanceof JsonWebTokenError) {
					res.status(HttpStatusCode.Unauthorized).send({
						error: {
							code: ErrorCodes.INVALID_SESSION,
							message: 'User session is no longer valid.'
						}
					});
					return;
				}

				throw e;
			}
		}),
		// @ts-ignore
		unlessOptions
	);
}

export { requiresAuthentication };

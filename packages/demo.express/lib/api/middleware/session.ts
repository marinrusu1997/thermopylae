import { CoreModule, HttpStatusCode, ObjMap, ErrorCodes as CoreErrorCodes, Library } from '@thermopylae/core.declarations';
import { ExpressRequestAdapter, ExpressResponseAdapter } from '@thermopylae/core.adapter.express';
import { JsonWebTokenError, TokenExpiredError } from '@thermopylae/lib.jwt-user-session';
import { Exception } from '@thermopylae/lib.exception';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import unless, { Options } from 'express-unless';
import handler from 'express-async-handler';
import { REQUEST_SESSION_SYM } from '../../app/constants';
import { logger } from '../../logger';
import { JWT_USER_SESSION_MIDDLEWARE } from '../../app/singletons';

const enum ErrorCodes {
	INVALID_SESSION = 'INVALID_SESSION',
	ACCESS_TOKEN_REQUIRED = 'ACCESS_TOKEN_REQUIRED',
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

				(req as any)[REQUEST_SESSION_SYM] = await JWT_USER_SESSION_MIDDLEWARE.verify(request, response, undefined, true);

				next();
			} catch (e) {
				if (e instanceof Exception) {
					logger.error('Verify user session failed.', e);

					if (e.emitter === CoreModule.USER_SESSION_COMMONS) {
						if (e.code === CoreErrorCodes.NOT_FOUND) {
							res.status(HttpStatusCode.BadRequest).send({
								error: {
									code: ErrorCodes.AUTHORIZATION_HEADER_INVALID_VALUE,
									message: e.message
								}
							});
							return;
						}
						if (e.code === CoreErrorCodes.UNPROCESSABLE) {
							res.status(HttpStatusCode.BadRequest).send({
								error: {
									code: ErrorCodes.AUTHORIZATION_HEADER_INVALID_SCHEME,
									message: e.message
								}
							});
							return;
						}
					}

					if (e.emitter === CoreModule.JWT_USER_SESSION) {
						if (e.code === CoreErrorCodes.NOT_FOUND) {
							res.status(HttpStatusCode.BadRequest).send({
								error: {
									code: ErrorCodes.ACCESS_TOKEN_REQUIRED,
									message: e.message
								}
							});
							return;
						}
						if (e.code === CoreErrorCodes.CHECK_FAILED) {
							res.status(HttpStatusCode.BadRequest).send({
								error: {
									code: ErrorCodes.CSRF_HEADER_REQUIRED,
									message: 'Correct value of the CSRF header is required for user session verify.'
								}
							});
							return;
						}
					}

					if (e.emitter === Library.JWT_USER_SESSION && e.code === CoreErrorCodes.INVALID) {
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

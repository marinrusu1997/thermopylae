import { HttpStatusCode } from '@thermopylae/core.declarations';
import { ExpressRequestAdapter, ExpressResponseAdapter } from '@thermopylae/core.adapter.express';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import unless, { Options } from 'express-unless';
import { REQUEST_SESSION_SYM } from '../../app/constants';
import { logger } from '../../logger';
import { JWT_USER_SESSION_MIDDLEWARE } from '../../app/singletons';

function requiresAuthentication(unlessOptions: Options): RequestHandler {
	return unless(async (req: Request, res: Response, next: NextFunction) => {
		try {
			const request = new ExpressRequestAdapter(req);
			const response = new ExpressResponseAdapter(res);

			(req as any)[REQUEST_SESSION_SYM] = await JWT_USER_SESSION_MIDDLEWARE.verify(request, response, undefined, true);

			next();
		} catch (e) {
			logger.error('Verify user session failed.', e);

			res.status(HttpStatusCode.Unauthorized).send({
				error: {
					code: 'INVALID_SESSION',
					message: 'User session is not valid.'
				}
			});
		}
		// @ts-ignore
	}, unlessOptions);
}

export { requiresAuthentication };

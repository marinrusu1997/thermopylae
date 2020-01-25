import { Jwt, VerifyOptions, JwtAuthMiddleware } from '@marin/lib.jwt';
import { Router, IRouter, Request } from 'express';
import { createException, ErrorCodes } from './error';
import { AuthRouter } from './auth-service';
import { getLogger } from './logger';

type JwtVerifyOptsProvider = (req: Request) => VerifyOptions | undefined;

class RestApiRouter {
	private static jwt: Jwt;

	private static router: IRouter;

	public static init(jwt: Jwt, jwtVerifyOptsProvider?: JwtVerifyOptsProvider) {
		if (RestApiRouter.jwt) {
			throw createException(ErrorCodes.REST_API_ROUTER_ALREADY_INITIALIZED, '');
		}

		RestApiRouter.jwt = jwt;
		RestApiRouter.router = Router();

		RestApiRouter.router.all(
			'*',
			JwtAuthMiddleware(RestApiRouter.jwt, {
				verifyOptsProvider: jwtVerifyOptsProvider,
				attach: 'pipeline.jwtPayload',
				unless: {
					useOriginalUrl: true,
					path: [
						{
							method: 'POST',
							url: new RegExp('/auth/session$')
						},
						{
							method: 'POST',
							url: new RegExp('/auth/account$')
						},
						{
							method: 'PUT',
							url: new RegExp('/account/activate$')
						}
					]
				},
				logger: getLogger()
			})
		);

		RestApiRouter.router.use('/auth', AuthRouter);
	}

	public static get ExpressRouter(): IRouter {
		if (!RestApiRouter.router) {
			throw createException(ErrorCodes.REST_API_ROUTER_NOT_INITIALIZED, '');
		}
		return RestApiRouter.router;
	}
}

export { RestApiRouter };

import { Jwt, VerifyOptions, JwtAuthMiddleware } from '@marin/lib.jwt';
import { Router, IRouter, Request, RequestHandler } from 'express';
import { createException, ErrorCodes } from './error';
import { getLogger } from './logger';
import { ServiceMethodSchema, ServiceName, ServiceRequestHandlers, ServiceRESTApiSchema, UnauthorizedEndpoint } from './types';

type JwtVerifyOptsProvider = (req: Request) => VerifyOptions | undefined;

class RestApiRouterFactory {
	static createRouter(
		jwt: Jwt,
		servicesRequestHandlers: Map<ServiceName, ServiceRequestHandlers>,
		servicesRESTApiSchemas: Array<ServiceRESTApiSchema>,
		requestPropNameWhereToAttachJwtPayload = 'pipeline.jwtPayload',
		jwtVerifyOptsProvider?: JwtVerifyOptsProvider
	): IRouter {
		const RestAPIRouter: IRouter = Router();

		const unauthorizedEndpoints: Array<UnauthorizedEndpoint> = [];

		// FIXME This will work only if JwtAuthMiddleware uses the same reference to unauthorized endpoints
		RestAPIRouter.all(
			'*',
			JwtAuthMiddleware(jwt, {
				verifyOptsProvider: jwtVerifyOptsProvider,
				attach: requestPropNameWhereToAttachJwtPayload,
				unless: {
					useOriginalUrl: true,
					path: unauthorizedEndpoints
				},
				logger: getLogger()
			})
		);

		let serviceRequestHandlers: ServiceRequestHandlers | undefined;
		let ServiceRouter: IRouter;
		for (const serviceRESTApiSchema of servicesRESTApiSchemas) {
			serviceRequestHandlers = servicesRequestHandlers.get(serviceRESTApiSchema.name);
			if (!serviceRequestHandlers) {
				throw createException(
					ErrorCodes.MISCONFIGURATION_SERVICE_REQUEST_HANDLERS_NOT_FOUND,
					`Couldn't find request handlers for ${serviceRESTApiSchema.name} service.`
				);
			}

			ServiceRouter = Router();

			let serviceMethodSchema: ServiceMethodSchema;
			let methodRequestHandlers: Array<RequestHandler>;
			// eslint-disable-next-line guard-for-in
			for (const serviceMethodName in serviceRESTApiSchema.methods) {
				methodRequestHandlers = serviceRequestHandlers[serviceMethodName];
				if (!methodRequestHandlers) {
					throw createException(
						ErrorCodes.MISCONFIGURATION_METHOD_REQUEST_HANDLERS_NOT_FOUND,
						`Couldn't find request handlers for ${serviceMethodName} method.`
					);
				}

				serviceMethodSchema = serviceRESTApiSchema.methods[serviceMethodName];
				serviceMethodSchema.path = serviceMethodSchema.path || '';
				ServiceRouter[serviceMethodSchema.method](serviceMethodSchema.path, methodRequestHandlers);

				if (serviceMethodSchema.unauthorized) {
					unauthorizedEndpoints.push({
						// @ts-ignore
						method: serviceMethodSchema.method.toUpperCase(),
						url: new RegExp(serviceMethodSchema.unauthorized)
					});
				}
			}

			RestAPIRouter.use(serviceRESTApiSchema.path, ServiceRouter);
		}

		return RestAPIRouter;
	}
}

export { RestApiRouterFactory, JwtVerifyOptsProvider, IRouter };

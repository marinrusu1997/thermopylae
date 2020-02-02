import { Jwt, VerifyOptions, JwtAuthMiddleware } from '@marin/lib.jwt';
import { fs } from '@marin/lib.utils';
import { Router, IRouter, Request, RequestHandler } from 'express';
import { readdir } from 'fs';
import { promisify } from 'util';
import { createException, ErrorCodes } from './error';
import { getLogger } from './logger';
import { ServiceMethodSchema, ServiceName, ServiceRequestHandlers, ServiceRESTApiSchema, UnauthorizedEndpoint } from './types';

type JwtVerifyOptsProvider = (req: Request) => VerifyOptions | undefined;

const readDir = promisify(readdir);

class RestApiRouterFactory {
	static async createRouter(
		jwt: Jwt,
		servicesRequestHandlers: Map<ServiceName, ServiceRequestHandlers>,
		pathToServicesRESTApiSchemas?: string,
		requestPropNameWhereToAttachJwtPayload = 'pipeline.jwtPayload',
		jwtVerifyOptsProvider?: JwtVerifyOptsProvider
	): Promise<IRouter> {
		pathToServicesRESTApiSchemas =
			pathToServicesRESTApiSchemas || `${process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`}/${process.env.APP_NAME}/rest-api`;

		const servicesRESTApiSchemas = await RestApiRouterFactory.readServicesRestApiSchemas(pathToServicesRESTApiSchemas);

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

				ServiceRouter[serviceMethodSchema.method](serviceMethodSchema.path || '/', methodRequestHandlers);

				if (serviceMethodSchema.unauthorized) {
					unauthorizedEndpoints.push({
						// @ts-ignore
						method: serviceMethodSchema.method.toUpperCase(),
						url: new RegExp(`${serviceRESTApiSchema.path}${serviceMethodSchema.path}$`)
					});
				}
			}

			RestAPIRouter.use(serviceRESTApiSchema.path, ServiceRouter);
		}

		return RestAPIRouter;
	}

	private static async readServicesRestApiSchemas(pathToSchemas: string): Promise<Array<ServiceRESTApiSchema>> {
		const serviceSchemasFiles = await readDir(pathToSchemas);
		const restApiSchemasPromises = [];
		for (const serviceSchemaFile of serviceSchemasFiles) {
			restApiSchemasPromises.push(fs.readJsonFromFile(`${pathToSchemas}/${serviceSchemaFile}`));
		}
		return ((await Promise.all(restApiSchemasPromises)) as unknown) as Promise<Array<ServiceRESTApiSchema>>;
	}
}

export { RestApiRouterFactory };

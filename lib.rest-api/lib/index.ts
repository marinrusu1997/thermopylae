import { Jwt, VerifyOptions, JwtAuthMiddleware } from '@marin/lib.jwt';
import { fs } from '@marin/lib.utils';
import { Services } from '@marin/lib.utils/dist/enums';
import { Router, IRouter, Request } from 'express';
import { readdir } from 'fs';
import { promisify } from 'util';
import { createException, ErrorCodes } from './error';
import { getLogger } from './logger';
import { ControllerMiddleware, ServiceMethod, ServiceRESTApi, ServiceRESTApiController, UnauthorizedEndpoint, ValidatorMiddleware } from './types';

type JwtVerifyOptsProvider = (req: Request) => VerifyOptions | undefined;

const readDir = promisify(readdir);

class RestApiRouter {
	private static jwt: Jwt;

	private static router: IRouter;

	public static async init(
		jwt: Jwt,
		serviceControllers: Map<Services, ServiceRESTApiController>,
		requestPropNameWhereToAttachJwtPayload = 'pipeline.jwtPayload',
		pathToServicesRESTApiSchemas?: string,
		jwtVerifyOptsProvider?: JwtVerifyOptsProvider
	): Promise<void> {
		if (RestApiRouter.jwt) {
			throw createException(ErrorCodes.REST_API_ROUTER_ALREADY_INITIALIZED, '');
		}

		pathToServicesRESTApiSchemas =
			pathToServicesRESTApiSchemas || `${process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`}/${process.env.APP_NAME}/rest-api`;

		const servicesRESTApi = await RestApiRouter.readServicesRestApiSchemas(pathToServicesRESTApiSchemas);

		RestApiRouter.jwt = jwt;
		RestApiRouter.router = Router();

		const unauthorizedEndpoints: Array<UnauthorizedEndpoint> = [];
		let serviceRESTApiController: ServiceRESTApiController | undefined;
		let ServiceRouter: IRouter;
		for (const serviceRESTApi of servicesRESTApi) {
			serviceRESTApiController = serviceControllers.get(serviceRESTApi.name);
			if (!serviceRESTApiController) {
				throw createException(ErrorCodes.MISCONFIGURATION_SERVICE_CONTROLLER_NOT_FOUND, `Couldn't find controller for ${serviceRESTApi.name} service.`);
			}

			ServiceRouter = Router();

			let serviceMethod: ServiceMethod;
			let serviceMethodValidator: ValidatorMiddleware | Array<ValidatorMiddleware> | undefined;
			let serviceMethodController: ControllerMiddleware | Array<ControllerMiddleware> | undefined;
			let middlewares: any[];

			// eslint-disable-next-line guard-for-in
			for (const serviceMethodName in serviceRESTApi.methods) {
				serviceMethod = serviceRESTApi.methods[serviceMethodName];
				serviceMethodController = serviceRESTApiController.controller[serviceMethodName];
				if (!serviceMethodController) {
					throw createException(ErrorCodes.MISCONFIGURATION_METHOD_CONTROLLER_NOT_FOUND, `Couldn't find controller for ${serviceMethodName} method.`);
				}
				serviceMethodValidator = serviceRESTApiController.validator[serviceMethodName];
				middlewares = [];

				if (serviceMethodValidator) {
					if (Array.isArray(serviceMethodValidator)) {
						middlewares.push(...serviceMethodValidator);
					} else {
						middlewares.push(serviceMethodValidator);
					}
				}
				if (Array.isArray(serviceMethodController)) {
					middlewares.push(...serviceMethodController);
				} else {
					middlewares.push(serviceMethodController);
				}

				ServiceRouter[serviceMethod.method](serviceMethod.path, middlewares);

				if (serviceMethod.unauthorized) {
					unauthorizedEndpoints.push({
						method: serviceMethod.method,
						url: new RegExp(`${serviceRESTApi.path}${serviceMethod.path}$`)
					});
				}
			}

			RestApiRouter.router.use(serviceRESTApi.path, ServiceRouter);
		}

		RestApiRouter.router.all(
			'*',
			JwtAuthMiddleware(RestApiRouter.jwt, {
				verifyOptsProvider: jwtVerifyOptsProvider,
				attach: requestPropNameWhereToAttachJwtPayload,
				unless: {
					useOriginalUrl: true,
					path: unauthorizedEndpoints
				},
				logger: getLogger()
			})
		);
	}

	public static get ExpressRouter(): IRouter {
		if (!RestApiRouter.router) {
			throw createException(ErrorCodes.REST_API_ROUTER_NOT_INITIALIZED, '');
		}
		return RestApiRouter.router;
	}

	private static async readServicesRestApiSchemas(pathToSchemas: string): Promise<Array<ServiceRESTApi>> {
		const serviceSchemasFiles = await readDir(pathToSchemas);
		const restApiSchemasPromises = [];
		for (const serviceSchemaFile of serviceSchemasFiles) {
			restApiSchemasPromises.push(fs.readJsonFromFile(serviceSchemaFile));
		}
		return ((await Promise.all(restApiSchemasPromises)) as unknown) as Promise<Array<ServiceRESTApi>>;
	}
}

export { RestApiRouter };

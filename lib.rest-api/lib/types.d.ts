import { Services } from '@marin/lib.utils/dist/enums';
import { Request, Response, NextFunction } from 'express';

export interface UnauthorizedEndpoint {
	method: string;
	url: RegExp;
}

export interface ServiceMethod {
	method: 'get' | 'head' | 'post' | 'put' | 'delete' | 'connect' | 'options' | 'trace' | 'patch';
	path: string;
	unauthorized?: boolean;
}

export interface ServiceRESTApi {
	name: Services;
	path: string;
	methods: {
		[name: string]: ServiceMethod;
	};
}

export type ValidatorMiddleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;
export type ControllerMiddleware = (req: Request, res: Response, next?: NextFunction) => void | Promise<void>;

export interface ServiceRESTApiController {
	validator: {
		[method: string]: ValidatorMiddleware | Array<ValidatorMiddleware>;
	};
	controller: {
		[method: string]: ControllerMiddleware | Array<ControllerMiddleware>;
	};
}

import { RequestHandler } from 'express';
import { HttpMethod } from '@marin/lib.utils/dist/declarations';

export type ServiceName = string;

export interface UnauthorizedEndpoint {
	method: HttpMethod;
	url: RegExp | string;
}

export interface ServiceMethodSchema {
	method: 'get' | 'head' | 'post' | 'put' | 'delete' | 'connect' | 'options' | 'trace' | 'patch';
	path?: string;
	unauthorized?: string;
}

export interface ServiceRESTApiSchema {
	name: ServiceName;
	path: string;
	methods: {
		[name: string]: ServiceMethodSchema;
	};
}

export interface ServiceRequestHandlers {
	[method: string]: Array<RequestHandler>;
}

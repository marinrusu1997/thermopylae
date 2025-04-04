import type { HttpVerb } from '@thermopylae/core.declarations';
import type { IssuedJwtPayload } from '@thermopylae/lib.jwt-user-session';
import type { Express, Request } from 'express';
import type { ParsedQs } from 'qs';
import { REQUEST_USER_SESSION_SYM } from './constants.js';

interface RequestWithUserSession<
	P = Record<string, string>,
	ResBody = any,
	ReqBody = any,
	ReqQuery = ParsedQs,
	Locals extends Record<string, any> = Record<string, any>
> extends Request<P, ResBody, ReqBody, ReqQuery, Locals> {
	readonly [REQUEST_USER_SESSION_SYM]?: IssuedJwtPayload;
}

type ApiSchema<ServiceMethod extends string> = Record<
	ServiceMethod,
	{
		path: string;
		verb: HttpVerb & keyof Express;
		requiresSession: boolean;
	}
>;

export type { RequestWithUserSession, ApiSchema };

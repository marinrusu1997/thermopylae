import { Express, Request } from 'express';
import { IssuedJwtPayload } from '@thermopylae/lib.jwt-user-session';
// eslint-disable-next-line node/no-extraneous-import, import/no-extraneous-dependencies
import { ParsedQs } from 'qs';
import type { HttpVerb } from '@thermopylae/core.declarations';
import { REQUEST_SESSION_SYM } from './app/constants';

interface RequestWithUserSession<
	P = Record<string, string>,
	ResBody = any,
	ReqBody = any,
	ReqQuery = ParsedQs,
	Locals extends Record<string, any> = Record<string, any>
> extends Request<P, ResBody, ReqBody, ReqQuery, Locals> {
	readonly [REQUEST_SESSION_SYM]?: IssuedJwtPayload;
}

type ApiSchema<ServiceMethod extends string> = Record<
	ServiceMethod,
	{
		path: string;
		verb: HttpVerb & keyof Express;
		requiresSession: boolean;
	}
>;

export { RequestWithUserSession, ApiSchema };

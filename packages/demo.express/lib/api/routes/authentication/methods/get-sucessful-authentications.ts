import { HttpStatusCode, type ObjMap } from '@thermopylae/core.declarations';
import type { SuccessfulAuthenticationModel } from '@thermopylae/lib.authentication';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import handler from 'express-async-handler';
// @ts-ignore This module has no typings
import isStringInt from 'is-string-int';
import { AUTHENTICATION_ENGINE } from '../../../../app/singletons.js';
import { REQUEST_USER_SESSION_SYM } from '../../../../constants.js';
import type { RequestWithUserSession } from '../../../../typings.js';

const enum ErrorCodes {
	INVALID_INPUT = 'INVALID_INPUT'
}

interface RequestQuery {
	from?: string;
	to?: string;
	[param: string]: string | undefined; // for typings
}

type ResponseBody =
	| {
			error?: {
				code: ErrorCodes;
				message: string | ObjMap;
			};
	  }
	| SuccessfulAuthenticationModel[];

const validateRequestQueryParams: RequestHandler<ObjMap, ResponseBody, never, RequestQuery> = (
	req: Request<ObjMap, ResponseBody, never, RequestQuery>,
	res: Response<ResponseBody>,
	next: NextFunction
) => {
	if (req.query.from != null && (!isStringInt(req.query.from) || ((req.query.from as unknown as number) = Number(req.query.from)) <= 0)) {
		res.status(HttpStatusCode.BadRequest).send({
			error: {
				code: ErrorCodes.INVALID_INPUT,
				message: "'from' query param needs to be a positive integer."
			}
		});
		return;
	}

	if (req.query.to != null && (!isStringInt(req.query.to) || ((req.query.to as unknown as number) = Number(req.query.to)) <= 0)) {
		res.status(HttpStatusCode.BadRequest).send({
			error: {
				code: ErrorCodes.INVALID_INPUT,
				message: "'to' query param needs to be a positive integer."
			}
		});
		return;
	}

	if (req.query.from != null && req.query.to != null && req.query.from > req.query.to) {
		res.status(HttpStatusCode.BadRequest).send({
			error: {
				code: ErrorCodes.INVALID_INPUT,
				message: "'from' can't be greater than 'to'."
			}
		});
		return;
	}

	next();
};

// @ts-ignore  The typings are not correct
const route = handler(async (req: RequestWithUserSession<ObjMap, ResponseBody, never, RequestQuery>, res: Response<ResponseBody>) => {
	res.status(HttpStatusCode.Ok).send(
		await AUTHENTICATION_ENGINE.getSuccessfulAuthentications(
			req[REQUEST_USER_SESSION_SYM]!.sub,
			req.query.from as number | undefined,
			req.query.to as number | undefined
		)
	);
});

export { validateRequestQueryParams, route };

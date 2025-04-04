import { HttpStatusCode, Library, type ObjMap } from '@thermopylae/core.declarations';
import { ErrorCodes as AuthenticationErrorCodes } from '@thermopylae/lib.authentication';
import { Exception } from '@thermopylae/lib.exception';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import handler from 'express-async-handler';
import { AUTHENTICATION_ENGINE } from '../../../../app/singletons.js';
import { logger } from '../../../../logger.js';

const enum ErrorCodes {
	INVALID_INPUT = 'INVALID_INPUT',
	INVALID_TOKEN = 'INVALID_TOKEN'
}

interface RequestQuery {
	token: string;
	[param: string]: string; // for typings
}

interface ResponseBody {
	error?: {
		code: ErrorCodes | AuthenticationErrorCodes;
		message: string | ObjMap;
	};
}

const validateRequestQueryParams: RequestHandler<ObjMap, ResponseBody, never, RequestQuery> = (
	req: Request<ObjMap, ResponseBody, never, RequestQuery>,
	res: Response<ResponseBody>,
	next: NextFunction
) => {
	if (typeof req.query.token !== 'string') {
		res.status(HttpStatusCode.BadRequest).send({
			error: {
				code: ErrorCodes.INVALID_INPUT,
				message: "'token' query param is required."
			}
		});
		return;
	}
	next();
};

// @ts-ignore The typings are not correct
const route = handler(async (req: Request<ObjMap, ResponseBody, never, RequestQuery>, res: Response<ResponseBody>) => {
	try {
		await AUTHENTICATION_ENGINE.activateAccount(req.query.token);
		res.status(HttpStatusCode.NoContent).send();
	} catch (e) {
		if (e instanceof Exception && e.emitter === Library.AUTHENTICATION) {
			logger.error(`Account activation failed. Request origin: ${req.ip}.`, e);

			if (e.code === AuthenticationErrorCodes.SESSION_NOT_FOUND) {
				res.status(HttpStatusCode.BadRequest).send({
					error: {
						code: ErrorCodes.INVALID_TOKEN,
						message: 'Activation token is not valid.'
					}
				});
				return;
			}

			if (e.code === AuthenticationErrorCodes.ACCOUNT_WITH_DUPLICATED_FIELDS) {
				res.status(HttpStatusCode.Conflict).send({
					error: {
						code: e.code,
						message: e.origin
					}
				});
				return;
			}
		}
		throw e;
	}
});

export { validateRequestQueryParams, route };

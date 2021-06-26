import { HttpStatusCode, Library, ObjMap } from '@thermopylae/core.declarations';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import handler from 'express-async-handler';
import { Exception } from '@thermopylae/lib.exception';
import { ErrorCodes as AuthenticationErrorCodes } from '@thermopylae/lib.authentication';
import { AUTHENTICATION_ENGINE } from '../../../../app/singletons';
import { logger } from '../../../../logger';

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
		code: ErrorCodes;
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

// @ts-ignore
const route = handler(async (req: Request<ObjMap, ResponseBody, never, RequestQuery>, res: Response<ResponseBody>) => {
	try {
		await AUTHENTICATION_ENGINE.activateAccount(req.query.token);
		res.status(HttpStatusCode.NoContent).send();
	} catch (e) {
		if (e instanceof Exception && e.emitter === Library.AUTHENTICATION && e.code === AuthenticationErrorCodes.SESSION_NOT_FOUND) {
			logger.error(`Account activation failed. Request origin: ${req.ip}.`, e);

			res.status(HttpStatusCode.BadRequest).send({
				error: {
					code: ErrorCodes.INVALID_TOKEN,
					message: 'Activation token is not valid.'
				}
			});
			return;
		}
		throw e;
	}
});

export { validateRequestQueryParams, route };

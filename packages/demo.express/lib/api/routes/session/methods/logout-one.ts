import handler from 'express-async-handler';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpStatusCode, ObjMap } from '@thermopylae/core.declarations';
import { ValidationError } from '@thermopylae/lib.api-validator';
import { API_VALIDATOR, JWT_USER_SESSION_MIDDLEWARE } from '../../../../app/singletons';
import { RequestWithUserSession } from '../../../../typings';
import { REQUEST_SESSION_SYM, SERVICE_NAME, ServiceMethod } from '../../../../app/constants';

const enum ErrorCodes {
	INVALID_INPUT = 'INVALID_INPUT'
}

interface RequestBody {
	'refresh-token': string;
}

interface ResponseBody {
	error?: {
		code: ErrorCodes;
		message: string | ObjMap;
	};
}

const validateRequestBody: RequestHandler = handler(
	async (req: Request<ObjMap, ResponseBody, RequestBody>, res: Response<ResponseBody>, next: NextFunction) => {
		try {
			await API_VALIDATOR.validate(SERVICE_NAME, ServiceMethod.LOGOUT_ONE, req.body);
			next();
		} catch (e) {
			if (e instanceof ValidationError) {
				res.status(HttpStatusCode.BadRequest).send({
					error: {
						code: ErrorCodes.INVALID_INPUT,
						message: API_VALIDATOR.joinErrors(e.errors, 'text')
					}
				});
				return;
			}
			throw e;
		}
	}
);

const route = handler(async (req: RequestWithUserSession<ObjMap, ResponseBody, RequestBody>, res: Response<ResponseBody>) => {
	await JWT_USER_SESSION_MIDDLEWARE.sessionManager.deleteOne(req[REQUEST_SESSION_SYM]!.sub, req.body['refresh-token']);
	res.status(HttpStatusCode.NoContent).send();
});

export { route, validateRequestBody };

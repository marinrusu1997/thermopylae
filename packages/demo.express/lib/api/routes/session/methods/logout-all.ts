import { ExpressRequestAdapter, ExpressResponseAdapter } from '@thermopylae/core.adapter.express';
import { HttpStatusCode } from '@thermopylae/core.declarations';
import type { Response } from 'express';
import handler from 'express-async-handler';
import { JWT_USER_SESSION_MIDDLEWARE } from '../../../../app/singletons.js';
import { REQUEST_USER_SESSION_SYM } from '../../../../constants.js';
import { ErrorCodes as AppErrorCodes, createException } from '../../../../error.js';
import type { RequestWithUserSession } from '../../../../typings.js';

interface ResponseBody {
	numberOfDeletedSessions: number;
}

const route = handler(async (req: RequestWithUserSession, res: Response<ResponseBody>) => {
	const request = new ExpressRequestAdapter(req);
	const response = new ExpressResponseAdapter(res);

	const userSession = req[REQUEST_USER_SESSION_SYM];
	if (!userSession) {
		throw createException(AppErrorCodes.MISCONFIGURATION, 'Request is missing user session');
	}

	const responseBody: ResponseBody = {
		numberOfDeletedSessions: await JWT_USER_SESSION_MIDDLEWARE.deleteAll(request, response, userSession.sub, userSession, true)
	};

	res.status(HttpStatusCode.Ok).send(responseBody);
});

export { route };

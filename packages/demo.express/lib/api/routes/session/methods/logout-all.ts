import { ExpressRequestAdapter, ExpressResponseAdapter } from '@thermopylae/core.adapter.express';
import { HttpStatusCode } from '@thermopylae/core.declarations';
import type { Response } from 'express';
import handler from 'express-async-handler';
import { JWT_USER_SESSION_MIDDLEWARE } from '../../../../app/singletons.js';
import { REQUEST_USER_SESSION_SYM } from '../../../../constants.js';
import type { RequestWithUserSession } from '../../../../typings.js';

interface ResponseBody {
	numberOfDeletedSessions: number;
}

const route = handler(async (req: RequestWithUserSession, res: Response<ResponseBody>) => {
	const request = new ExpressRequestAdapter(req);
	const response = new ExpressResponseAdapter(res);

	const responseBody: ResponseBody = {
		numberOfDeletedSessions: await JWT_USER_SESSION_MIDDLEWARE.deleteAll(
			request,
			response,
			req[REQUEST_USER_SESSION_SYM]!.sub,
			req[REQUEST_USER_SESSION_SYM]!,
			true
		)
	};

	res.status(HttpStatusCode.Ok).send(responseBody);
});

export { route };

import handler from 'express-async-handler';
import { Response } from 'express';
import { ExpressRequestAdapter, ExpressResponseAdapter } from '@thermopylae/core.adapter.express';
import { HttpStatusCode } from '@thermopylae/core.declarations';
import { JWT_USER_SESSION_MIDDLEWARE } from '../../../../app/singletons';
import { RequestWithUserSession } from '../../../../typings';
import { REQUEST_SESSION_SYM } from '../../../../app/constants';

interface ResponseBody {
	numberOfDeletedSessions: number;
}

const route = handler(async (req: RequestWithUserSession, res: Response<ResponseBody>) => {
	const request = new ExpressRequestAdapter(req);
	const response = new ExpressResponseAdapter(res);

	const responseBody: ResponseBody = {
		numberOfDeletedSessions: await JWT_USER_SESSION_MIDDLEWARE.deleteAll(request, response, req[REQUEST_SESSION_SYM]!.sub, req[REQUEST_SESSION_SYM]!, true)
	};

	res.status(HttpStatusCode.Ok).send(responseBody);
});

export { route };

import handler from 'express-async-handler';
import { Response } from 'express';
import { HttpStatusCode } from '@thermopylae/core.declarations';
import { JWT_USER_SESSION_MIDDLEWARE } from '../../../../app/singletons';
import { RequestWithUserSession } from '../../../../typings';
import { REQUEST_USER_SESSION_SYM } from '../../../../constants';

const route = handler(async (req: RequestWithUserSession, res: Response) => {
	const sessions = await JWT_USER_SESSION_MIDDLEWARE.sessionManager.readAll(req[REQUEST_USER_SESSION_SYM]!.sub);
	res.status(HttpStatusCode.Ok).send(Object.fromEntries(sessions));
});

export { route };

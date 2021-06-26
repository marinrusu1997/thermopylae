import handler from 'express-async-handler';
import { Response } from 'express';
import { HttpStatusCode } from '@thermopylae/core.declarations';
import { JWT_USER_SESSION_MIDDLEWARE } from '../../../../app/singletons';
import { RequestWithUserSession } from '../../../../typings';
import { REQUEST_SESSION_SYM } from '../../../../app/constants';

const route = handler(async (req: RequestWithUserSession, res: Response) => {
	const sessions = await JWT_USER_SESSION_MIDDLEWARE.sessionManager.readAll(req[REQUEST_SESSION_SYM]!.sub);
	res.status(HttpStatusCode.Ok).send(Object.fromEntries(sessions));
});

export { route };

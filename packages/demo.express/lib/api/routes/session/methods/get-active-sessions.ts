import { HttpStatusCode } from '@thermopylae/core.declarations';
import type { Response } from 'express';
import handler from 'express-async-handler';
import { JWT_USER_SESSION_MIDDLEWARE } from '../../../../app/singletons.js';
import { REQUEST_USER_SESSION_SYM } from '../../../../constants.js';
import type { RequestWithUserSession } from '../../../../typings.js';

const route = handler(async (req: RequestWithUserSession, res: Response) => {
	const sessions = await JWT_USER_SESSION_MIDDLEWARE.sessionManager.readAll(req[REQUEST_USER_SESSION_SYM]!.sub);
	res.status(HttpStatusCode.Ok).send(Object.fromEntries(sessions));
});

export { route };

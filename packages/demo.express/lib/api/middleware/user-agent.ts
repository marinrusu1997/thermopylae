import { RequestHandler } from 'express';
import { HttpStatusCode } from '@thermopylae/core.declarations';

const userAgent: RequestHandler = (req, res, next) => {
	if (req.header('user-agent') != null) {
		return next();
	}
	res.status(HttpStatusCode.BadRequest).send("'User-Agent' header is required.");
};

export { userAgent };

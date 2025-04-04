import { HttpStatusCode } from '@thermopylae/core.declarations';
import type { RequestHandler } from 'express';

const jsonBody: RequestHandler = (req, res, next) => {
	if (req.is('json')) {
		return next();
	}
	res.status(HttpStatusCode.UnsupportedMediaType).send("Unsupported 'Content-Type'. Use: json");
};

export { jsonBody };

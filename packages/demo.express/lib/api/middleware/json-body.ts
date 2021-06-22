import { RequestHandler } from 'express';
import { HttpStatusCode } from '@thermopylae/core.declarations';

const jsonBody: RequestHandler = (req, res, next) => {
	if (req.is('json')) {
		return next();
	}
	res.status(HttpStatusCode.UnsupportedMediaType).send("Unsupported 'Content-Type'. Use: json");
};

export { jsonBody };

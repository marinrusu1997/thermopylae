import { ErrorRequestHandler } from 'express';
import { HttpStatusCode } from '@thermopylae/core.declarations';
import { logger } from '../../logger';

const serverError: ErrorRequestHandler = (error, req, res, _next) => {
	logger.error(`Exception was thrown while handling request with id: ${(req as any).id} on path: ${req.path} .`, error);
	res.sendStatus(HttpStatusCode.InternalServerError);
};

export { serverError };

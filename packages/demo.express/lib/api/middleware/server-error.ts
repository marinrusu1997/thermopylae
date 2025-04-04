import { HttpStatusCode } from '@thermopylae/core.declarations';
import type { ErrorRequestHandler } from 'express';
import { logger } from '../../logger.js';

const serverError: ErrorRequestHandler = (error, req, res, _next) => {
	logger.error(`Exception was thrown while handling request with id: ${(req as any).id} on path: ${req.path} .`, error);
	res.sendStatus(HttpStatusCode.InternalServerError);
};

export { serverError };

import { Router } from 'express';

const apiRouter = Router({
	caseSensitive: true,
	mergeParams: false,
	strict: true
});

export { apiRouter };

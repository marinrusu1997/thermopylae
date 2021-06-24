import { Router } from 'express';
import { API_SCHEMA } from './schema';
import { userAgent } from './middleware/user-agent';
import { jsonBody } from './middleware/json-body';
import { ipLocation } from './middleware/ip-location';
import { validateRequestBody as validateAuthenticateRequestBody, route as authenticateRoute } from './routes/authenticate';

const apiRouter = Router({
	caseSensitive: true,
	mergeParams: false,
	strict: true
});

apiRouter[API_SCHEMA.authenticate.method](API_SCHEMA.authenticate.path, userAgent, jsonBody, validateAuthenticateRequestBody, ipLocation, authenticateRoute);

export { apiRouter };

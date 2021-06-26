import { Router } from 'express';
import { ROUTER_OPTIONS } from '../../../app/constants';
import { API_SCHEMA } from './schema';
import { userAgent } from '../../middleware/user-agent';
import { jsonBody } from '../../middleware/json-body';
import { ipLocation } from '../../middleware/ip-location';
import { validateRequestBody as validateRefreshUserSessionRequestBody, route as refreshUserSessionRoute } from './methods/refresh';
import { route as getActiveUserSessionsRoute } from './methods/get-active-sessions';
import { route as logoutRoute } from './methods/logout';
import { route as logoutAllRoute } from './methods/logout-all';

const userSessionRouter = Router(ROUTER_OPTIONS);

userSessionRouter[API_SCHEMA.refreshUserSession.verb](
	API_SCHEMA.refreshUserSession.path,
	userAgent,
	jsonBody,
	validateRefreshUserSessionRequestBody,
	ipLocation,
	refreshUserSessionRoute
);
userSessionRouter[API_SCHEMA.getActiveUserSessions.verb](API_SCHEMA.getActiveUserSessions.path, getActiveUserSessionsRoute);
userSessionRouter[API_SCHEMA.logout.verb](API_SCHEMA.logout.path, logoutRoute);
userSessionRouter[API_SCHEMA.logoutAll.verb](API_SCHEMA.logoutAll.path, userAgent, logoutAllRoute);

export { userSessionRouter };

import { Router } from 'express';
import { ROUTER_OPTIONS } from '../../../constants.js';
import { ipLocation } from '../../middleware/ip-location.js';
import { jsonBody } from '../../middleware/json-body.js';
import { userAgent } from '../../middleware/user-agent.js';
import { route as getActiveUserSessionsRoute } from './methods/get-active-sessions.js';
import { route as logoutAllRoute } from './methods/logout-all.js';
import { route as logoutOneRoute, validateRequestBody as validateLogoutOneRequestBody } from './methods/logout-one.js';
import { route as logoutRoute } from './methods/logout.js';
import { route as refreshUserSessionRoute, validateRequestBody as validateRefreshUserSessionRequestBody } from './methods/refresh.js';
import { API_SCHEMA } from './schema.js';

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
userSessionRouter[API_SCHEMA.logoutOne.verb](API_SCHEMA.logoutOne.path, jsonBody, validateLogoutOneRequestBody, logoutOneRoute);
userSessionRouter[API_SCHEMA.logoutAll.verb](API_SCHEMA.logoutAll.path, userAgent, logoutAllRoute);

export { userSessionRouter };

import { Router } from 'express';
import { ROUTER_OPTIONS } from '../../../constants.js';
import { ipLocation } from '../../middleware/ip-location.js';
import { jsonBody } from '../../middleware/json-body.js';
import { userAgent } from '../../middleware/user-agent.js';
import { route as activateAccountRoute, validateRequestQueryParams as validateActivateAccountRequestQueryParams } from './methods/activate-account.js';
import { route as authenticateRoute, validateRequestBody as validateAuthenticateRequestBody } from './methods/authenticate.js';
import {
	route as changeForgottenPasswordRoute,
	validateRequestBody as validateChangeForgottenPasswordRequestBody
} from './methods/change-forgotten-password.js';
import { route as changePasswordRoute, validateRequestBody as validateChangePasswordRequestBody } from './methods/change-password.js';
import {
	route as createForgotPasswordSessionRoute,
	validateRequestBody as validateCreateForgotPasswordSessionRequestBody
} from './methods/create-forgot-password-session.js';
import {
	route as getFailedAuthenticationsRoute,
	validateRequestQueryParams as validateGetFailedAuthenticationsRequestQueryParams
} from './methods/get-failed-authentications.js';
import {
	route as getSuccessfulAuthenticationsRoute,
	validateRequestQueryParams as validateGetSuccessfulAuthenticationsRequestQueryParams
} from './methods/get-sucessful-authentications.js';
import { route as registerRoute, validateRequestBody as validateRegisterRequestBody } from './methods/register.js';
import { route as setTwoFactorAuthEnabledRoute, validateRequestBody as validateSetTwoFactorAuthEnabledRequestBody } from './methods/set-2fa-enabled.js';
import { API_SCHEMA } from './schema.js';

const authenticationRouter = Router(ROUTER_OPTIONS);

authenticationRouter[API_SCHEMA.authenticate.verb](
	API_SCHEMA.authenticate.path,
	userAgent,
	jsonBody,
	validateAuthenticateRequestBody,
	ipLocation,
	authenticateRoute
);
authenticationRouter[API_SCHEMA.register.verb](API_SCHEMA.register.path, jsonBody, validateRegisterRequestBody, registerRoute);
authenticationRouter[API_SCHEMA.activateAccount.verb](API_SCHEMA.activateAccount.path, validateActivateAccountRequestQueryParams, activateAccountRoute);
authenticationRouter[API_SCHEMA.setTwoFactorAuthEnabled.verb](
	API_SCHEMA.setTwoFactorAuthEnabled.path,
	userAgent,
	jsonBody,
	validateSetTwoFactorAuthEnabledRequestBody,
	ipLocation,
	setTwoFactorAuthEnabledRoute
);
authenticationRouter[API_SCHEMA.getFailedAuthentications.verb](
	API_SCHEMA.getFailedAuthentications.path,
	validateGetFailedAuthenticationsRequestQueryParams,
	getFailedAuthenticationsRoute
);
authenticationRouter[API_SCHEMA.getSuccessfulAuthentications.verb](
	API_SCHEMA.getSuccessfulAuthentications.path,
	validateGetSuccessfulAuthenticationsRequestQueryParams,
	getSuccessfulAuthenticationsRoute
);
authenticationRouter[API_SCHEMA.changePassword.verb](
	API_SCHEMA.changePassword.path,
	userAgent,
	jsonBody,
	validateChangePasswordRequestBody,
	ipLocation,
	changePasswordRoute
);
authenticationRouter[API_SCHEMA.createForgotPasswordSession.verb](
	API_SCHEMA.createForgotPasswordSession.path,
	jsonBody,
	validateCreateForgotPasswordSessionRequestBody,
	createForgotPasswordSessionRoute
);
authenticationRouter[API_SCHEMA.changeForgottenPassword.verb](
	API_SCHEMA.changeForgottenPassword.path,
	jsonBody,
	validateChangeForgottenPasswordRequestBody,
	changeForgottenPasswordRoute
);

export { authenticationRouter };

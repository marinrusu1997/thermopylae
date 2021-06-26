import { Router } from 'express';
import { API_SCHEMA } from './schema';
import { userAgent } from '../../middleware/user-agent';
import { jsonBody } from '../../middleware/json-body';
import { ipLocation } from '../../middleware/ip-location';
import { validateRequestBody as validateAuthenticateRequestBody, route as authenticateRoute } from './methods/authenticate';
import { validateRequestBody as validateRegisterRequestBody, route as registerRoute } from './methods/register';
import { validateRequestQueryParams as validateActivateAccountRequestQueryParams, route as activateAccountRoute } from './methods/activate-account';
import { validateRequestBody as validateSetTwoFactorAuthEnabledRequestBody, route as setTwoFactorAuthEnabledRoute } from './methods/set-2fa-enabled';
import {
	validateRequestQueryParams as validateGetFailedAuthenticationsRequestQueryParams,
	route as getFailedAuthenticationsRoute
} from './methods/get-failed-authentications';
import {
	validateRequestQueryParams as validateGetSuccessfulAuthenticationsRequestQueryParams,
	route as getSuccessfulAuthenticationsRoute
} from './methods/get-sucessful-authentications';
import { validateRequestBody as validateChangePasswordRequestBody, route as changePasswordRoute } from './methods/change-password';
import {
	validateRequestBody as validateCreateForgotPasswordSessionRequestBody,
	route as createForgotPasswordSessionRoute
} from './methods/create-forgot-password-session';
import { validateRequestBody as validateChangeForgottenPasswordRequestBody, route as changeForgottenPasswordRoute } from './methods/change-forgotten-password';
import { ROUTER_OPTIONS } from '../../../app/constants';

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

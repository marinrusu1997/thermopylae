import { Router } from 'express';
import { API_SCHEMA } from './schema';
import { userAgent } from './middleware/user-agent';
import { jsonBody } from './middleware/json-body';
import { ipLocation } from './middleware/ip-location';
import { validateRequestBody as validateAuthenticateRequestBody, route as authenticateRoute } from './routes/authenticate';
import { validateRequestBody as validateRegisterRequestBody, route as registerRoute } from './routes/register';
import { validateRequestQueryParams as validateActivateAccountRequestQueryParams, route as activateAccountRoute } from './routes/activate-account';
import { validateRequestBody as validateSetTwoFactorAuthEnabledRequestBody, route as setTwoFactorAuthEnabledRoute } from './routes/set-2fa-enabled';
import { validateRequestQueryParams as validateActivateAccountRequestQueryParams, route as activateAccountRoute } from './routes/get-failed-authentications';

const apiRouter = Router({
	caseSensitive: true,
	mergeParams: false,
	strict: true
});

apiRouter[API_SCHEMA.authenticate.method](API_SCHEMA.authenticate.path, userAgent, jsonBody, validateAuthenticateRequestBody, ipLocation, authenticateRoute);
apiRouter[API_SCHEMA.register.method](API_SCHEMA.register.path, jsonBody, validateRegisterRequestBody, registerRoute);
apiRouter[API_SCHEMA.activateAccount.method](API_SCHEMA.activateAccount.path, validateActivateAccountRequestQueryParams, activateAccountRoute);
apiRouter[API_SCHEMA.setTwoFactorAuthEnabled.method](
	API_SCHEMA.setTwoFactorAuthEnabled.path,
	userAgent,
	jsonBody,
	validateSetTwoFactorAuthEnabledRequestBody,
	ipLocation,
	setTwoFactorAuthEnabledRoute
);
apiRouter[API_SCHEMA.getFailedAuthentications.method](
	API_SCHEMA.getFailedAuthentications.path,
	validateActivateAccountRequestQueryParams,
	activateAccountRoute
);

export { apiRouter };

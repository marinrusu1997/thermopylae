import { AuthController, AuthValidator } from '@marin/lib.auth-controller';
import { IRouter, Router } from 'express';
import asyncHandler from 'express-async-handler';

const AuthRouter: IRouter = Router();

AuthRouter.post('/session/user', asyncHandler(AuthValidator.authenticate), asyncHandler(AuthController.authenticate));
AuthRouter.post('/account', asyncHandler(AuthValidator.register), asyncHandler(AuthController.register));
AuthRouter.put('/account/activate', asyncHandler(AuthValidator.activateAccount), asyncHandler(AuthController.activateAccount));
AuthRouter.put('/multifactor', AuthValidator.enableMultiFactorAuthentication, asyncHandler(AuthController.enableMultiFactorAuthentication));
AuthRouter.get('/session/user/active', AuthValidator.getActiveSessions, asyncHandler(AuthController.getActiveSessions));
AuthRouter.get(
	'/failed_auth_attempts',
	asyncHandler(AuthValidator.getFailedAuthenticationAttempts),
	asyncHandler(AuthController.getFailedAuthenticationAttempts)
);
AuthRouter.put('/account/password/change', asyncHandler(AuthValidator.changePassword), asyncHandler(AuthController.changePassword));
AuthRouter.post('/session/forgot_password', asyncHandler(AuthValidator.createForgotPasswordSession), asyncHandler(AuthController.createForgotPasswordSession));
AuthRouter.put('/account/password/reset', asyncHandler(AuthValidator.changeForgottenPassword), asyncHandler(AuthController.changeForgottenPassword));

export { AuthRouter };

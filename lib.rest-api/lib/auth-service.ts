import { AuthController, AuthValidator } from '@marin/lib.auth-controller';
import { IRouter, Router } from 'express';
import asyncHandler from 'express-async-handler';

const AuthRouter: IRouter = Router();

AuthRouter.post('/session', asyncHandler(AuthValidator.authenticate), asyncHandler(AuthController.authenticate));
AuthRouter.post('/account', asyncHandler(AuthValidator.register), asyncHandler(AuthController.register));
AuthRouter.put('/account/activate', asyncHandler(AuthValidator.activateAccount), asyncHandler(AuthController.activateAccount));
AuthRouter.put('/account/multifactor', AuthValidator.enableMultiFactorAuthentication, asyncHandler(AuthController.enableMultiFactorAuthentication));
AuthRouter.get('/session', asyncHandler(AuthController.getActiveSessions));
AuthRouter.get(
	'/failed_auth_attempts',
	asyncHandler(AuthValidator.getFailedAuthenticationAttempts),
	asyncHandler(AuthController.getFailedAuthenticationAttempts)
);

export { AuthRouter };
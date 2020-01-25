import { AuthController, AuthValidator } from '@marin/lib.auth-controller';
import { Router } from 'express';
import asyncHandler from 'express-async-handler';

const AuthRouter: Router = Router();

AuthRouter.post('/session', asyncHandler(AuthValidator.authenticate), asyncHandler(AuthController.authenticate));
AuthRouter.post('/account', asyncHandler(AuthValidator.register), asyncHandler(AuthController.register));

export { AuthRouter };

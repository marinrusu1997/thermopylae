import { AuthController, AuthValidator } from '@marin/lib.auth-controller';
import { Router } from 'express';
import asyncHandler from 'express-async-handler';

const AuthRouter: Router = Router();

AuthRouter.post('/signin', asyncHandler(AuthValidator.authenticate), asyncHandler(AuthController.authenticate));

export { AuthRouter };

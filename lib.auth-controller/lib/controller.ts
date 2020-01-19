// eslint-disable-next-line import/no-extraneous-dependencies
import { AuthenticationEngine } from '@marin/lib.auth-engine';
import { Firewall } from '@marin/lib.firewall';
// eslint-disable-next-line import/no-unresolved
import { Request, Response } from 'express';

class AuthController {
	private static authenticationEngine: AuthenticationEngine;

	public static init(authenticationEngine: AuthenticationEngine): void {
		AuthController.authenticationEngine = authenticationEngine;
	}

	public static authenticate(req: Request, res: Response): Promise<void> {}
}

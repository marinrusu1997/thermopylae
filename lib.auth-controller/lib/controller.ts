import Exception from '@marin/lib.error';
import { Libraries } from '@marin/lib.utils/dist/enums';
import { AuthenticationEngine, ErrorCodes as AuthEngineErrorCodes } from '@marin/lib.auth-engine';
import { Request, Response } from 'express';
import { getLogger } from './logger';
import { createException, ErrorCodes } from './error';

class AuthController {
	private static authenticationEngine: AuthenticationEngine;

	public static init(authenticationEngine: AuthenticationEngine): void {
		AuthController.authenticationEngine = authenticationEngine;
	}

	public static async authenticate(req: Request, res: Response): Promise<void> {
		const authStatus = await AuthController.authenticationEngine.authenticate(req.body);

		if (authStatus.token && !authStatus.nextStep) {
			res.status(200).json({ token: authStatus.token });
			return;
		}

		if (authStatus.nextStep) {
			if (authStatus.error && authStatus.error.soft) {
				getLogger().warning(`Soft error while authenticating.`, authStatus.error.soft);
				res.status(401).json({ nextStep: authStatus.nextStep });
				return;
			}
			res.status(202).json({ nextStep: authStatus.nextStep, token: authStatus.token });
			return;
		}

		if (authStatus.error && authStatus.error.hard) {
			getLogger().alert(`Hard error while authenticating.`, authStatus.error.hard);
			res.status(410).send();
			return;
		}

		throw createException(ErrorCodes.MISCONFIGURATION, "Authentication completed, but it's status couldn't be resolved.");
	}

	public static async register(req: Request, res: Response): Promise<void> {
		try {
			await AuthController.authenticationEngine.register(req.body, { isActivated: false, enableMultiFactorAuth: req.body.enableMultiFactorAuth });
		} catch (e) {
			if (e.emitter === Libraries.AUTH_ENGINE) {
				const httpResponseCode = e.code === AuthEngineErrorCodes.ACCOUNT_ALREADY_REGISTERED ? 409 : 400;
				res.status(httpResponseCode).json({ code: e.code });
				return;
			}
			throw e;
		}
	}

	public static async activateAccount(req: Request, res: Response): Promise<void> {
		try {
			await AuthController.authenticationEngine.activateAccount(req.params.token);
		} catch (e) {
			if (e instanceof Exception && e.emitter === Libraries.AUTH_ENGINE) {
				res.status(404).json({ code: e.code }); // only SESSION_NOT_FOUND can be thrown
				return;
			}
			throw e;
		}
	}
}

export { AuthController };

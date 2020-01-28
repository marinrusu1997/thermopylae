import { Libraries } from '@marin/lib.utils/dist/enums';
import { AuthenticationEngine, ErrorCodes as AuthEngineErrorCodes } from '@marin/lib.auth-engine';
import { Request, Response } from 'express';
import { getLogger } from './logger';
import { createException, ErrorCodes } from './error';

class AuthController {
	private static authenticationEngine: AuthenticationEngine;

	static init(authenticationEngine: AuthenticationEngine): void {
		// FIXME pass name of prop where jwt payload is attached
		AuthController.authenticationEngine = authenticationEngine;
	}

	static async authenticate(req: Request, res: Response): Promise<void> {
		try {
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
		} catch (e) {
			getLogger().alert('An error non related to authentication happened while executing AuthEngine.authenticate method. Sending 400', e);
			res.status(400).send();
		}
	}

	static async register(req: Request, res: Response): Promise<void> {
		try {
			await AuthController.authenticationEngine.register(req.body, {
				isActivated: false,
				enableMultiFactorAuth: req.body.enableMultiFactorAuth
			});
			res.status(202).send();
		} catch (e) {
			if (e.emitter === Libraries.AUTH_ENGINE) {
				const httpResponseCode = e.code === AuthEngineErrorCodes.ACCOUNT_ALREADY_REGISTERED ? 409 : 400;
				res.status(httpResponseCode).json({ code: e.code });
				return;
			}
			throw e;
		}
	}

	static async activateAccount(req: Request, res: Response): Promise<void> {
		try {
			await AuthController.authenticationEngine.activateAccount(req.params.token);
			res.status(204).send();
		} catch (e) {
			if (e.emitter === Libraries.AUTH_ENGINE) {
				res.status(404).json({ code: e.code }); // only SESSION_NOT_FOUND can be thrown
				return;
			}
			throw e;
		}
	}

	static async enableMultiFactorAuthentication(req: Request, res: Response): Promise<void> {
		// @ts-ignore
		const accountId: string = req.pipeline.jwtPayload.sub;
		// @ts-ignore
		const enabled: boolean = req.params.enable;
		await AuthController.authenticationEngine.enableMultiFactorAuthentication(accountId, enabled);
		res.status(204).send();
	}

	static async getActiveSessions(req: Request, res: Response): Promise<void> {
		const activeSessions = await AuthController.authenticationEngine.getActiveSessions(req.params.accountId);
		res.status(200).json(activeSessions);
	}

	static async getFailedAuthenticationAttempts(req: Request, res: Response): Promise<void> {
		const { accountId } = req.params;
		// @ts-ignore
		const startingFrom: number = req.params.from;
		// @ts-ignore
		const endingTo: number = req.params.to;

		const failedAuthAttempts = await AuthController.authenticationEngine.getFailedAuthAttempts(accountId, startingFrom, endingTo);
		res.status(200).json(failedAuthAttempts);
	}

	static async changePassword(req: Request, res: Response): Promise<void> {
		try {
			const numberOfLoggedOutSessions = await AuthController.authenticationEngine.changePassword(req.body);
			if (typeof numberOfLoggedOutSessions === 'undefined') {
				res.status(204).send();
			} else {
				res.status(200).json({ numberOfLoggedOutSessions });
			}
		} catch (e) {
			if (e.emitter === Libraries.AUTH_ENGINE) {
				let httpResponseStatus;
				switch (e.code) {
					case AuthEngineErrorCodes.ACCOUNT_NOT_FOUND:
						httpResponseStatus = 404;
						break;
					case AuthEngineErrorCodes.ACCOUNT_LOCKED:
						httpResponseStatus = 410;
						break;
					case AuthEngineErrorCodes.INCORRECT_PASSWORD:
						httpResponseStatus = 401;
						break;
					case AuthEngineErrorCodes.WEAK_PASSWORD:
						httpResponseStatus = 400;
						break;
					default:
						// will be processed by global handled with a 500 Server Error
						throw createException(
							ErrorCodes.MISCONFIGURATION_STATUS_CODE_COULD_NOT_BE_DETERMINED,
							"Could't determine http response code from Exception thrown by AuthEngine.changePassword method."
						);
				}
				res.status(httpResponseStatus).json({ code: e.code });
				return;
			}

			throw e;
		}
	}

	static async createForgotPasswordSession(req: Request, res: Response): Promise<void> {
		await AuthController.authenticationEngine.createForgotPasswordSession(req.body);
		res.status(202).send();
	}

	static async changeForgottenPassword(req: Request, res: Response): Promise<void> {
		try {
			await AuthController.authenticationEngine.changeForgottenPassword(req.body);
			res.status(204).send();
		} catch (e) {
			if (e.emitter === Libraries.AUTH_ENGINE) {
				let httpResponseStatus;
				switch (e.code) {
					case AuthEngineErrorCodes.SESSION_NOT_FOUND:
						httpResponseStatus = 404;
						break;
					case AuthEngineErrorCodes.WEAK_PASSWORD:
						httpResponseStatus = 400;
						break;
					default:
						// will be processed by global handled with a 500 Server Error
						throw createException(
							ErrorCodes.MISCONFIGURATION_STATUS_CODE_COULD_NOT_BE_DETERMINED,
							"Could't determine http response code from Exception thrown by AuthEngine.changeForgottenPassword method."
						);
				}
				res.status(httpResponseStatus).json({ code: e.code });
				return;
			}

			throw e;
		}
	}

	static async validateAccountCredentials(req: Request, res: Response): Promise<void> {
		// FIXME this should be mounted into internal rest api router
		try {
			const areValid = await AuthController.authenticationEngine.areAccountCredentialsValid(req.params.accountId, req.body);
			res.status(200).json({ areValid });
		} catch (e) {
			if (e.emitter === Libraries.AUTH_ENGINE && e.code === AuthEngineErrorCodes.ACCOUNT_NOT_FOUND) {
				res.status(404).send({ code: e.code });
			}

			throw e;
		}
	}
}

export { AuthController };

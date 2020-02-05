import { Libraries, HttpStatusCode } from '@marin/lib.utils/dist/declarations';
import { AuthenticationEngine, ErrorCodes as AuthEngineErrorCodes } from '@marin/lib.auth-engine';
import { LogoutType } from '@marin/declarations/lib/auth';
import { Request, Response } from 'express';
import get from 'lodash.get';
import { AuthServiceMethods } from '@marin/declarations/lib/services';
import { getLogger } from './logger';
import { createException, ErrorCodes } from './error';

class AuthController {
	private static authenticationEngine: AuthenticationEngine;

	private static jwtPayloadPathInReqObj: string;

	static init(authenticationEngine: AuthenticationEngine, jwtPayloadPathInReqObj = 'pipeline.jwtPayload'): void {
		AuthController.authenticationEngine = authenticationEngine;
		AuthController.jwtPayloadPathInReqObj = jwtPayloadPathInReqObj;
	}

	static async authenticate(req: Request, res: Response): Promise<void> {
		let remoteIp;
		try {
			remoteIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
			const authStatus = await AuthController.authenticationEngine.authenticate(req.body);

			if (authStatus.token && !authStatus.nextStep) {
				res.status(HttpStatusCode.OK).json({ token: authStatus.token });
				return;
			}

			if (authStatus.nextStep) {
				if (authStatus.error && authStatus.error.soft) {
					getLogger().error(
						`${AuthServiceMethods.AUTHENTICATE} failed. Request body: ${JSON.stringify(req.body)}. Request origin: ${remoteIp}. Cause: `,
						authStatus.error.soft
					);
					res.status(HttpStatusCode.UNAUTHORIZED).json({ nextStep: authStatus.nextStep });
					return;
				}
				res.status(HttpStatusCode.ACCEPTED).json({ nextStep: authStatus.nextStep, token: authStatus.token });
				return;
			}

			if (authStatus.error && authStatus.error.hard) {
				getLogger().alert(
					`${AuthServiceMethods.AUTHENTICATE} failed. Request body: ${JSON.stringify(req.body)}. Request origin: ${remoteIp}. Cause: `,
					authStatus.error.hard
				);
				res.status(HttpStatusCode.GONE).send();
				return;
			}

			throw createException(ErrorCodes.MISCONFIGURATION, "Authentication completed, but it's status couldn't be resolved.", authStatus);
		} catch (e) {
			getLogger().error(`${AuthServiceMethods.AUTHENTICATE} failed. Request body: ${JSON.stringify(req.body)}. Request origin: ${remoteIp}. Cause: `, e);
			res.status(HttpStatusCode.BAD_REQUEST).send();
		}
	}

	static async register(req: Request, res: Response): Promise<void> {
		try {
			await AuthController.authenticationEngine.register(req.body, {
				isActivated: false,
				enableMultiFactorAuth: req.body.enableMultiFactorAuth
			});
			res.status(HttpStatusCode.ACCEPTED).send();
		} catch (e) {
			if (e.emitter === Libraries.AUTH_ENGINE) {
				const remoteIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
				getLogger().error(`${AuthServiceMethods.REGISTER} failed. Request body: ${JSON.stringify(req.body)}. Request origin: ${remoteIp}. Cause: `, e);

				const httpResponseCode = e.code === AuthEngineErrorCodes.ACCOUNT_ALREADY_REGISTERED ? HttpStatusCode.CONFLICT : HttpStatusCode.BAD_REQUEST;
				res.status(httpResponseCode).json({ code: e.code });
				return;
			}
			throw e;
		}
	}

	static async activateAccount(req: Request, res: Response): Promise<void> {
		try {
			await AuthController.authenticationEngine.activateAccount(req.query.token);
			res.status(HttpStatusCode.NO_CONTENT).send();
		} catch (e) {
			if (e.emitter === Libraries.AUTH_ENGINE) {
				const remoteIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
				getLogger().error(
					`${AuthServiceMethods.ACTIVATE_ACCOUNT} failed. Query params: ${JSON.stringify(req.query)}. Request origin: ${remoteIp}. Cause: `,
					e
				);

				res.status(HttpStatusCode.BAD_REQUEST).json({ code: ErrorCodes.INVALID_TOKEN });
				return;
			}
			throw e;
		}
	}

	static async enableMultiFactorAuthentication(req: Request, res: Response): Promise<void> {
		// @ts-ignore
		const accountId: string = get(req, AuthController.jwtPayloadPathInReqObj).sub;
		// @ts-ignore
		await AuthController.authenticationEngine.enableMultiFactorAuthentication(accountId, req.query.enable);
		res.status(HttpStatusCode.NO_CONTENT).send();
	}

	static async getActiveSessions(req: Request, res: Response): Promise<void> {
		const activeSessions = await AuthController.authenticationEngine.getActiveSessions(req.query.accountId);
		res.status(HttpStatusCode.OK).json(activeSessions);
	}

	static async getFailedAuthenticationAttempts(req: Request, res: Response): Promise<void> {
		// @ts-ignore
		const failedAuthAttempts = await AuthController.authenticationEngine.getFailedAuthAttempts(req.query.accountId, req.query.from, req.query.to);
		res.status(HttpStatusCode.OK).json(failedAuthAttempts);
	}

	static async changePassword(req: Request, res: Response): Promise<void> {
		try {
			const numberOfLoggedOutSessions = await AuthController.authenticationEngine.changePassword(req.body);
			if (typeof numberOfLoggedOutSessions === 'undefined') {
				res.status(HttpStatusCode.NO_CONTENT).send();
			} else {
				res.status(HttpStatusCode.OK).json({ numberOfLoggedOutSessions });
			}
		} catch (e) {
			if (e.emitter === Libraries.AUTH_ENGINE) {
				const remoteIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
				getLogger().error(
					`${AuthServiceMethods.CHANGE_PASSWORD} failed. Request body: ${JSON.stringify(req.body)}. Request origin: ${remoteIp}. Cause: `,
					e
				);

				let httpResponseStatus;
				switch (e.code) {
					case AuthEngineErrorCodes.ACCOUNT_NOT_FOUND:
						httpResponseStatus = HttpStatusCode.NOT_FOUND;
						break;
					case AuthEngineErrorCodes.ACCOUNT_LOCKED:
						httpResponseStatus = HttpStatusCode.GONE;
						break;
					case AuthEngineErrorCodes.INCORRECT_PASSWORD:
						httpResponseStatus = HttpStatusCode.UNAUTHORIZED;
						break;
					case AuthEngineErrorCodes.WEAK_PASSWORD:
						httpResponseStatus = HttpStatusCode.BAD_REQUEST;
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
		res.status(HttpStatusCode.ACCEPTED).send();
	}

	static async changeForgottenPassword(req: Request, res: Response): Promise<void> {
		try {
			await AuthController.authenticationEngine.changeForgottenPassword(req.body);
			res.status(HttpStatusCode.NO_CONTENT).send();
		} catch (e) {
			if (e.emitter === Libraries.AUTH_ENGINE) {
				const remoteIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
				getLogger().error(
					`${AuthServiceMethods.CHANGE_FORGOTTEN_PASSWORD} failed. Request body: ${JSON.stringify(req.body)}. Request origin: ${remoteIp}. Cause: `,
					e
				);

				let code;
				switch (e.code) {
					case AuthEngineErrorCodes.SESSION_NOT_FOUND:
						code = ErrorCodes.INVALID_TOKEN;
						break;
					case AuthEngineErrorCodes.WEAK_PASSWORD:
						code = AuthEngineErrorCodes.WEAK_PASSWORD;
						break;
					default:
						// will be processed by global handled with a 500 Server Error
						throw createException(
							ErrorCodes.MISCONFIGURATION_STATUS_CODE_COULD_NOT_BE_DETERMINED,
							"Could't determine http response code from Exception thrown by AuthEngine.changeForgottenPassword method."
						);
				}
				res.status(HttpStatusCode.BAD_REQUEST).json({ code });
				return;
			}

			throw e;
		}
	}

	static async validateAccountCredentials(req: Request, res: Response): Promise<void> {
		// FIXME this should be mounted into internal rest api router
		try {
			const valid = await AuthController.authenticationEngine.areAccountCredentialsValid(req.body.accountId, req.body);
			res.status(HttpStatusCode.OK).json({ valid });
		} catch (e) {
			if (e.emitter === Libraries.AUTH_ENGINE && e.code === AuthEngineErrorCodes.ACCOUNT_NOT_FOUND) {
				const remoteIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
				getLogger().error(
					`${AuthServiceMethods.VALIDATE_ACCOUNT_CREDENTIALS} failed. Request body: ${JSON.stringify(
						req.body
					)}. Request origin: ${remoteIp}. Cause: `,
					e
				);

				res.status(HttpStatusCode.NOT_FOUND).json({ code: e.code });
				return;
			}

			throw e;
		}
	}

	static async changeAccountLockStatus(req: Request, res: Response): Promise<void> {
		try {
			if (req.query.enable) {
				await AuthController.authenticationEngine.lockAccount(req.body.accountId, req.body.cause);
			} else {
				await AuthController.authenticationEngine.unlockAccount(req.body.accountId);
			}
			res.status(HttpStatusCode.NO_CONTENT).send();
		} catch (e) {
			if (e.emitter === Libraries.AUTH_ENGINE && e.code === AuthEngineErrorCodes.ACCOUNT_NOT_FOUND) {
				const remoteIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
				getLogger().error(
					`${AuthServiceMethods.CHANGE_ACCOUNT_LOCK_STATUS} failed. Request body: ${JSON.stringify(req.body)}. Query params: ${JSON.stringify(
						req.query
					)}. Request origin: ${remoteIp}. Cause: `,
					e
				);

				res.status(HttpStatusCode.NOT_FOUND).json({ code: e.code });
				return;
			}

			throw e;
		}
	}

	static async logout(req: Request, res: Response): Promise<void> {
		const jwtPayload = get(req, AuthController.jwtPayloadPathInReqObj);

		try {
			let loggedOutSessions = 1;
			switch (req.query.type as LogoutType) {
				case LogoutType.CURRENT_SESSION:
					await AuthController.authenticationEngine.logout(jwtPayload);
					break;
				case LogoutType.ALL_SESSIONS:
					loggedOutSessions = await AuthController.authenticationEngine.logoutFromAllDevices(jwtPayload);
					break;
				case LogoutType.ALL_SESSIONS_EXCEPT_CURRENT:
					loggedOutSessions = await AuthController.authenticationEngine.logoutFromAllDevicesExceptFromCurrent(jwtPayload.sub, jwtPayload.iat);
					break;
			}
			res.status(HttpStatusCode.OK).json({ loggedOutSessions });
		} catch (e) {
			if (e.emitter === Libraries.AUTH_ENGINE) {
				const remoteIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
				getLogger().error(
					`${AuthServiceMethods.LOGOUT} failed. Query params: ${JSON.stringify(req.query)}. JWT: ${JSON.stringify(
						jwtPayload
					)}. Request origin: ${remoteIp}. Cause: `,
					e
				);

				let httpResponseStatus;
				switch (e.code) {
					case AuthEngineErrorCodes.ACCOUNT_NOT_FOUND:
						httpResponseStatus = HttpStatusCode.NOT_FOUND;
						break;
					case AuthEngineErrorCodes.JWT_TTL_NOT_FOUND:
						throw createException(
							ErrorCodes.MISCONFIGURATION_JWT_TTL_FOR_ACCOUNT_NOT_FOUND_BY_AUTH_ENGINE,
							`JWT TTL for account ${jwtPayload.sub} not found when logout of type ${req.query.type} has been made.`
						);
					default:
						throw createException(
							ErrorCodes.MISCONFIGURATION_STATUS_CODE_COULD_NOT_BE_DETERMINED,
							`Couldn't determine HTTP response code after logout of type ${req.query.type}.`
						);
				}
				res.status(httpResponseStatus).json({ code: e.code });
				return;
			}

			throw e;
		}
	}
}

export { AuthController };

import { Firewall } from '@marin/lib.firewall';
import { boolean, number } from '@marin/lib.utils';
import { GeoIP } from '@marin/lib.geoip';
import { AuthServiceMethods, Services } from '@marin/declarations/lib/services';
import { AccountRole, LogoutType } from '@marin/declarations/lib/auth';
import { HttpStatusCode } from '@marin/lib.utils/dist/declarations';
import { NextFunction, Request, Response } from 'express';
import get from 'lodash.get';
import { getLogger } from './logger';
import { IIssuedJWTPayload } from '../../lib.jwt';
import { ErrorCodes } from './error';

type ExpressResponseMethod = 'json' | 'send';

interface ResponseBodyOnError {
	method: ExpressResponseMethod;
	body: any;
}

const LogoutTypes = [LogoutType.CURRENT_SESSION, LogoutType.ALL_SESSIONS, LogoutType.ALL_SESSIONS_EXCEPT_CURRENT];

class AuthValidator {
	private static geoIP: GeoIP;

	private static jwtPayloadPathInReqObj: string;

	public static init(geoIp: GeoIP, jwtPayloadPathInReqObj = 'pipeline.jwtPayload'): void {
		AuthValidator.geoIP = geoIp;
		AuthValidator.jwtPayloadPathInReqObj = jwtPayloadPathInReqObj;
	}

	/**
	 * POST /api/rest/v1/auth/session/user
	 * Body args: { username, password?, totp?, recaptcha?, generateChallenge?, responseForChallenge? }
	 */
	static async authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			req.body.ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
			req.body.device = req.headers['user-agent'];
			await Firewall.validate(Services.AUTH, AuthServiceMethods.AUTHENTICATE, req.body);
			req.body.location = await AuthValidator.geoIP.locate(req.body.ip);

			next();
		} catch (e) {
			AuthValidator.handleError('authenticate', e, res);
		}
	}

	/**
	 * POST /api/rest/v1/auth/account
	 * Body args: { username, password, email, telephone, pubKey?, enableMultiFactorAuth? }
	 */
	static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			req.body.role = AccountRole.USER;
			await Firewall.validate(Services.AUTH, AuthServiceMethods.REGISTER, req.body);
			req.body.email = Firewall.sanitize(req.body.email);

			next();
		} catch (e) {
			AuthValidator.handleError('register', e, res);
		}
	}

	/**
	 * PUT /api/rest/v1/auth/account/activate?token=hfhfhhfhf
	 *
	 * Flow: req to this endpoint from email link, web server intercepts response
	 * and redirects to endpoint with prepared html page based on response success
	 * This way Referer header won't be present
	 */
	static async activateAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			await Firewall.validate(Services.AUTH, AuthServiceMethods.ACTIVATE_ACCOUNT, { activateAccountToken: req.query.token });

			next();
		} catch (e) {
			AuthValidator.handleError('activate account', e, res);
		}
	}

	/**
	 * PUT /api/rest/v1/auth/account/multi_factor?enable=boolean
	 */
	static enableMultiFactorAuthentication(req: Request, res: Response, next: NextFunction): void {
		try {
			// @ts-ignore
			req.query.enable = boolean.toBoolean(req.query.enable, true);
			next();
		} catch (e) {
			AuthValidator.handleError(' enable multi factor authentication', e, res, {
				method: 'json',
				body: {
					enable: 'query param is required and needs to be a boolean'
				}
			});
		}
	}

	/**
	 * GET /api/rest/v1/auth/session?accountId=ajsdhasjd
	 */
	static async getActiveSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
		const jwtPayload = get(req, AuthValidator.jwtPayloadPathInReqObj);

		if (req.query.accountId) {
			if (!AuthValidator.validateAdminPermissions('get user active sessions', req, jwtPayload)) {
				res.status(HttpStatusCode.FORBIDDEN).send();
				return;
			}

			try {
				await Firewall.validate(Services.AUTH, AuthServiceMethods.GET_ACTIVE_SESSIONS, { accountId: req.query.accountId });
			} catch (e) {
				return AuthValidator.handleError(`get active sessions (by ${AccountRole.ADMIN})`, e, res);
			}
		} else {
			// @ts-ignore
			req.query.accountId = jwtPayload.sub;
		}

		next();
	}

	/**
	 * GET /api/rest/v1/auth/failed_auth_attempts?accountId=ashduah45&from=12456789&to=456975566
	 */
	static async getFailedAuthenticationAttempts(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			if (!AuthValidator.validateAdminPermissions('get failed authentication attempts', req)) {
				res.status(HttpStatusCode.FORBIDDEN).send();
				return;
			}

			// @ts-ignore
			req.query.from = number.toNumber(req.query.from);
			// @ts-ignore
			req.query.to = number.toNumber(req.query.to);

			const query = { accountId: req.query.accountId, startingFrom: req.query.from, endingTo: req.query.to };
			await Firewall.validate(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, query);

			next();
		} catch (e) {
			AuthValidator.handleError(`get failed authentication attempts (by ${AccountRole.ADMIN})`, e, res);
		}
	}

	/**
	 * PUT /api/rest/v1/auth/account/password/change
	 * Body: { old: "password", new: "password", logAllOtherSessionsOut?: false }
	 */
	static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			await Firewall.validate(Services.AUTH, AuthServiceMethods.CHANGE_PASSWORD, req.body);

			const jwtPayload = get(req, AuthValidator.jwtPayloadPathInReqObj);
			// @ts-ignore
			req.body.sessionId = jwtPayload.iat;
			// @ts-ignore
			req.body.accountId = jwtPayload.sub;

			next();
		} catch (e) {
			AuthValidator.handleError('change password', e, res);
		}
	}

	/**
	 * POST /api/rest/v1/auth/session/forgot_password
	 * BODY { username: "username", side-channel: "email" }
	 */
	static async createForgotPasswordSession(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			await Firewall.validate(Services.AUTH, AuthServiceMethods.CREATE_FORGOT_PASSWORD_SESSION, req.body);

			next();
		} catch (e) {
			AuthValidator.handleError('create forgot password session', e, res);
		}
	}

	/**
	 * PUT /api/rest/v1/auth/account/password/reset
	 * Body { token: "string", newPassword: "string" }
	 */
	static async changeForgottenPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			await Firewall.validate(Services.AUTH, AuthServiceMethods.CHANGE_FORGOTTEN_PASSWORD, req.body);

			next();
		} catch (e) {
			AuthValidator.handleError('change forgotten password', e, res);
		}
	}

	/**
	 * POST /internal/api/rest/v1/auth/account/credentials/validate
	 * Body { accountId: "string", username: "string", password: "password" }
	 *
	 * Exposed via private ip for other microservices
	 */
	static async validateAccountCredentials(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			await Firewall.validate(Services.AUTH, AuthServiceMethods.VALIDATE_ACCOUNT_CREDENTIALS, req.body);

			next();
		} catch (e) {
			AuthValidator.handleError('validate account credentials', e, res);
		}
	}

	/**
	 * PUT /api/rest/v1/auth/account/lock?enable=boolean
	 * Body { accountId: string, cause?: string }
	 */
	static async changeAccountLockStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			if (!AuthValidator.validateAdminPermissions('change account lock status', req)) {
				res.status(HttpStatusCode.FORBIDDEN).send();
				return;
			}

			// @ts-ignore
			req.query.enable = boolean.toBoolean(req.query.enable, true);
			await Firewall.validate(Services.AUTH, AuthServiceMethods.CHANGE_ACCOUNT_LOCK_STATUS, { ...req.body, enable: req.query.enable });
			req.body.cause = req.body.cause ? Firewall.sanitize(req.body.cause) : req.body.cause;

			next();
		} catch (e) {
			AuthValidator.handleError('changed account lock status', e, res);
		}
	}

	/**
	 * DELETE /api/rest/v1/auth/session/user?type=enum
	 */
	static logout(req: Request, res: Response, next: NextFunction): void {
		// @ts-ignore
		if (!LogoutTypes.includes(req.query.type)) {
			res.status(HttpStatusCode.BAD_REQUEST).json({ type: ErrorCodes.INVALID_LOGOUT_TYPE });
			return;
		}
		next();
	}

	private static handleError(methodName: string, e: any, res: Response, body?: ResponseBodyOnError): void {
		let messageToLog;
		let errorToLog;
		let errorBody: ResponseBodyOnError | undefined = body;
		if (e.errors) {
			messageToLog = `Failed to gather and validate network input for ${methodName} method. Validation errors: ${Firewall.joinErrors(
				e.errors,
				'text'
			)}. `;
			errorToLog = new Error();
			if (!errorBody) {
				errorBody = {
					method: 'json',
					body: Firewall.joinErrors(e.errors, 'object') as object
				};
				if (Object.getOwnPropertyNames(errorBody.body).length === 0) {
					errorBody.method = 'send';
					errorBody.body = undefined;
				}
			}
		} else {
			messageToLog = `Failed to gather and validate network input for ${methodName} method. `;
			errorToLog = e;
			if (!errorBody) {
				errorBody = {
					method: 'send',
					body: undefined
				};
			}
		}

		getLogger().error(messageToLog, errorToLog);
		res.status(HttpStatusCode.BAD_REQUEST)[errorBody.method](errorBody.body);
	}

	private static validateAdminPermissions(action: string, req: Request, jwtPayload?: IIssuedJWTPayload): boolean {
		// @ts-ignore
		jwtPayload = jwtPayload || get(req, AuthValidator.jwtPayloadPathInReqObj);
		// @ts-ignore
		if (jwtPayload.aud !== AccountRole.ADMIN) {
			const remoteIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
			getLogger().warning(
				`Detected an attempt to ${action} for  account with id ${req.query.accountId || req.body.accountId} by an user without ${
					AccountRole.ADMIN
				} role. His jwt: ${JSON.stringify(jwtPayload)}. Request originated from: ${remoteIp}.`
			);
			return false;
		}
		return true;
	}
}

export { AuthValidator };

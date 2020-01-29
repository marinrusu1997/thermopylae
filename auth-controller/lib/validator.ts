import { Firewall } from '@marin/lib.firewall';
import { GeoIP } from '@marin/lib.geoip';
import { AuthServiceMethods, Services } from '@marin/declarations/services';
import { AccountRole } from '@marin/declarations/auth';
import { HttpStatusCode } from '@marin/lib.utils/dist/enums';
import { NextFunction, Request, Response } from 'express';
import get from 'lodash.get';
import { getLogger } from './logger';

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
			getLogger().error(`Failed to gather and validate network input for login method.`, e);
			// if e.errors is null | undefined, will throw error, which will be processed by global error handler
			res.status(HttpStatusCode.BAD_REQUEST).send();
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
			req.body = Firewall.sanitize(
				req.body,
				new Set<string>(['username', 'password', 'pubKey'])
			);

			next();
		} catch (e) {
			getLogger().error(`Failed to gather and validate network input for register method.`, e);
			// if e.errors is null | undefined, will throw error, which will be processed by global error handler
			res.status(HttpStatusCode.BAD_REQUEST).json(Firewall.joinErrors(e.errors, 'object'));
		}
	}

	/**
	 * PUT /api/rest/v1/auth/account/activate?token=hfhfhhfhf
	 *
	 * Flow: req to this endpoint from email link, web server intercepts response
	 * and redirects to endpoint with prepared httl page based on response success
	 * This way Referer header won't be present
	 */
	static async activateAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			await Firewall.validate(Services.AUTH, AuthServiceMethods.ACTIVATE_ACCOUNT, { activateAccountToken: req.params.token });

			next();
		} catch (e) {
			getLogger().error(`Failed to gather and validate network input for activate account method.`, e);
			// if e.errors is null | undefined, will throw error, which will be processed by global error handler
			res.status(HttpStatusCode.BAD_REQUEST).json(Firewall.joinErrors(e.errors, 'object'));
		}
	}

	/**
	 * PUT /api/rest/v1/auth/account/multi_factor?enable=boolean
	 */
	static enableMultiFactorAuthentication(req: Request, res: Response, next: NextFunction): void {
		if (req.params.enable === 'true' || req.params.enable === '1') {
			// @ts-ignore
			req.params.enable = true;
			return next();
		}

		if (req.params.enable === 'false' || req.params.enable === '0') {
			// @ts-ignore
			req.params.enable = false;
			return next();
		}

		res.status(HttpStatusCode.BAD_REQUEST).json({ enable: 'query param is required and needs to be a boolean' });
	}

	/**
	 * GET /api/rest/v1/auth/session?accountId=ajsdhasjd
	 */
	static getActiveSessions(req: Request, res: Response, next: NextFunction): void {
		const jwtPayload = get(req, AuthValidator.jwtPayloadPathInReqObj);

		if (req.params.accountId) {
			// @ts-ignore
			const accountRole: string = jwtPayload.aud;
			if (accountRole !== AccountRole.ADMIN) {
				res.status(HttpStatusCode.FORBIDDEN).send();
				return;
			}
		} else {
			// @ts-ignore
			req.params.accountId = jwtPayload.sub;
		}

		next();
	}

	/**
	 * GET /api/rest/v1/auth/failed_auth_attempts?accountId=ashduah45&from=12456789&to=456975566
	 */
	static async getFailedAuthenticationAttempts(req: Request, res: Response, next: NextFunction): Promise<void> {
		// @ts-ignore
		const accountRole: string = get(req, AuthValidator.jwtPayloadPathInReqObj).aud; // if not present, treat as server error
		if (accountRole !== AccountRole.ADMIN) {
			res.status(HttpStatusCode.FORBIDDEN).send();
			return;
		}

		try {
			// @ts-ignore
			req.params.from = Number(req.params.from);
			// @ts-ignore
			req.params.to = Number(req.params.to);

			const query = { accountId: req.params.accountId, startingFrom: req.params.from, endingTo: req.params.to };
			await Firewall.validate(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, query);

			next();
		} catch (e) {
			getLogger().error(`Failed to gather and validate network input for get failed authentication attempts method.`, e);
			// if e.errors is null | undefined, will throw error, which will be processed by global error handler
			res.status(HttpStatusCode.BAD_REQUEST).json(Firewall.joinErrors(e.errors, 'object'));
		}
	}

	/**
	 * PUT /api/rest/v1/auth/account/password/change
	 * Body: { old: "password", new: "password", logAllOtherSessionsOut?: false }
	 */
	static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
		const jwtPayload = get(req, AuthValidator.jwtPayloadPathInReqObj); // if not present, treat as internal server error
		try {
			await Firewall.validate(Services.AUTH, AuthServiceMethods.CHANGE_PASSWORD, req.body);
			// @ts-ignore
			req.body.sessionId = jwtPayload.iat;
			// @ts-ignore
			req.body.accountId = jwtPayload.sub;

			next();
		} catch (e) {
			getLogger().error(`Failed to gather and validate network input for change password method.`, e);
			// if e.errors is null | undefined, will throw error, which will be processed by global error handler
			res.status(HttpStatusCode.BAD_REQUEST).json(Firewall.joinErrors(e.errors, 'object'));
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
			getLogger().error(`Failed to gather and validate network input for create forgot password session method.`, e);
			// if e.errors is null | undefined, will throw error, which will be processed by global error handler
			res.status(HttpStatusCode.BAD_REQUEST).json(Firewall.joinErrors(e.errors, 'object'));
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
			getLogger().error(`Failed to gather and validate network input for create forgot password session method.`, e);
			// if e.errors is null | undefined, will throw error, which will be processed by global error handler
			res.status(HttpStatusCode.BAD_REQUEST).json(Firewall.joinErrors(e.errors, 'object'));
		}
	}

	/**
	 * POST /internal/api/rest/v1/auth/account/credentials/validate?accountId=asd12
	 * Body { username: "string", password: "password" }
	 *
	 * Exposed via private ip for other microservices
	 */
	static async validateAccountCredentials(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			await Firewall.validate(Services.AUTH, AuthServiceMethods.VALIDATE_ACCOUNT_CREDENTIALS, { ...req.body, accountId: req.params.accountId });

			next();
		} catch (e) {
			getLogger().error(`Failed to gather and validate network input for validate account credentials method.`, e);
			// if e.errors is null | undefined, will throw error, which will be processed by global error handler
			res.status(HttpStatusCode.BAD_REQUEST).json(Firewall.joinErrors(e.errors, 'object'));
		}
	}
}

export { AuthValidator };

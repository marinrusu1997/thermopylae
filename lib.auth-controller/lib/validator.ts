import { Firewall } from '@marin/lib.firewall';
import { AccountRole, AuthServiceMethods, Services } from '@marin/lib.utils/dist/enums';
import { NextFunction, Request, Response } from 'express';
import { GeoIP } from '@marin/lib.geoip';
import { getLogger } from './logger';

class AuthValidator {
	private static geoIP: GeoIP;

	public static init(geoIp: GeoIP): void {
		AuthValidator.geoIP = geoIp;
	}

	/**
	 * POST /api/rest/auth/session
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
			res.status(400).send();
		}
	}

	/**
	 * POST /api/rest/auth/account
	 * Body args: { username, password, email, telephone, pubKey?, enableMultiFactorAuth? }
	 */
	static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			req.body.role = AccountRole.USER;
			await Firewall.validate(Services.AUTH, AuthServiceMethods.REGISTER, req.body);
			req.body = Firewall.sanitize(req.body);

			next();
		} catch (e) {
			getLogger().error(`Failed to gather and validate network input for register method.`, e);
			res.status(400).json(Firewall.joinErrors(e.errors, 'object'));
		}
	}

	/**
	 * PUT /api/rest/auth/account/activate?token=hfhfhhfhf
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
			res.status(400).json(Firewall.joinErrors(e.errors, 'object'));
		}
	}

	/**
	 * PUT /api/rest/auth/account/multifactor?enable=boolean
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

		res.status(400).json({ enable: 'query param is required and needs to be a boolean' });
	}

	/**
	 * GET /api/rest/auth/failed_auth_attempts?accountId=ashduah45&from=12456789&to=456975566
	 */
	static async getFailedAuthenticationAttempts(req: Request, res: Response, next: NextFunction): Promise<void> {
		// @ts-ignore
		const accountRole: string = req.pipeline.jwtPayload.aud;
		if (accountRole !== AccountRole.ADMIN) {
			res.status(403).send();
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
			res.status(400).json(Firewall.joinErrors(e.errors, 'object'));
		}
	}
}

export { AuthValidator };

import { AuthenticationEngine } from '@marin/lib.auth-engine';
import { GeoIP } from '@marin/lib.geoip';
import { Services, AuthServiceMethods } from '@marin/lib.utils/dist/enums';
import { Firewall } from '@marin/lib.firewall';
import { Request, Response } from 'express';
import { getLogger } from './logger';
import { createException, ErrorCodes } from './error';

class AuthController {
	private static authenticationEngine: AuthenticationEngine;

	private static geoip: GeoIP;

	public static init(authenticationEngine: AuthenticationEngine, geoip: GeoIP): void {
		AuthController.authenticationEngine = authenticationEngine;
		AuthController.geoip = geoip;
	}

	/**
	 * POST /api/rest/auth/login
	 * Body args: { username, password?, totp?, recaptcha?, generateChallenge?, responseForChallenge? }
	 */
	public static async authenticate(req: Request, res: Response): Promise<void> {
		try {
			req.body.ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
			req.body.device = req.headers['user-agent'];
			req.body = await Firewall.validate(Services.AUTH, AuthServiceMethods.AUTHENTICATE, req.body);
			req.body = Firewall.sanitize(req.body as object);
			req.body.location = await AuthController.geoip.locate(req.body.ip);
		} catch (e) {
			getLogger().error(`Failed to gather and validate network input for login method. `, e);
			return (res.status(400).send() as unknown) as undefined;
		}

		try {
			const authStatus = await AuthController.authenticationEngine.authenticate(req.body);
			if (authStatus.token && authStatus.nextStep) {
				return (res.status(200).json({ token: authStatus.token }) as unknown) as undefined;
			}
			if (authStatus.nextStep) {
				if (authStatus.error && authStatus.error.soft) {
					getLogger().warning(`Soft error while authenticating. Request body: ${JSON.stringify(req.body)}`, authStatus.error.soft);
					return (res.status(401).json({ nextStep: authStatus.nextStep }) as unknown) as undefined;
				}
				return (res.status(202).json({ nextStep: authStatus.nextStep, token: authStatus.token }) as unknown) as undefined;
			}
			if (authStatus.error && authStatus.error.hard) {
				getLogger().alert(`Hard error while authenticating. Request body: ${JSON.stringify(req.body)}`, authStatus.error.hard);
				return (res.status(410).send() as unknown) as undefined;
			}

			throw createException(ErrorCodes.MISCONFIGURATION, "Authentication completed, but it's status couldn't be resolved. ");
		} catch (e) {
			getLogger().error(`Failed to authenticate. Request body: ${JSON.stringify(req.body)}`, e);
			return (res.status(500).send() as unknown) as undefined;
		}
	}
}

export { AuthController };

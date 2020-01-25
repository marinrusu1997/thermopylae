import { Firewall } from '@marin/lib.firewall';
import { AuthServiceMethods, Services, AccountRole } from '@marin/lib.utils/dist/enums';
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
			req.body = Firewall.sanitize(req.body);
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
}

export { AuthValidator };

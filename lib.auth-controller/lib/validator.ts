import { Firewall } from '@marin/lib.firewall';
import { AuthServiceMethods, Services } from '@marin/lib.utils/dist/enums';
import { Request, Response, NextFunction } from 'express';
import { GeoIP } from '@marin/lib.geoip';
import { getLogger } from './logger';

class AuthValidator {
	private static geoIP: GeoIP;

	public static init(geoIp: GeoIP): void {
		AuthValidator.geoIP = geoIp;
	}

	/**
	 * POST /api/rest/auth/login
	 * Body args: { username, password?, totp?, recaptcha?, generateChallenge?, responseForChallenge? }
	 */
	static async authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			req.body.ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
			req.body.device = req.headers['user-agent'];
			req.body = await Firewall.validate(Services.AUTH, AuthServiceMethods.AUTHENTICATE, req.body);
			req.body = Firewall.sanitize(req.body as object);
			req.body.location = await AuthValidator.geoIP.locate(req.body.ip);

			next();
		} catch (e) {
			getLogger().error(`Failed to gather and validate network input for login method.`, e);
			res.status(400).send();
		}
	}
}

export { AuthValidator };

import { ErrorCodes } from '@thermopylae/core.declarations';
import type { HttpRequest, HTTPRequestLocation, Undefinable } from '@thermopylae/core.declarations';
import type { UserSessionOperationContext } from '@thermopylae/lib.user-session.commons';
import type { ExceptionFactory, UserSessionDevice } from './typings';

class UserSessionUtils {
	public static buildUserSessionContext(req: HttpRequest): UserSessionOperationContext<UserSessionDevice, HTTPRequestLocation> {
		return {
			ip: req.ip,
			device:
				req.device && req.device.device
					? {
							name: `${req.device.device.brand} ${req.device.device.model}`,
							type: req.device.device.type,
							client: req.device.client,
							os: req.device.os
					  }
					: null,
			location: req.location || null
		};
	}

	public static extractTokenFromAuthorization(authorization: string | undefined | null, exceptionFactory: ExceptionFactory): string {
		// it's mandatory to handle missing header, invalid scheme, missing token

		if (typeof authorization !== 'string') {
			throw exceptionFactory(ErrorCodes.NOT_FOUND, `Authorization header value not present.`);
		}

		const [scheme, token] = authorization.split(' ') as [Undefinable<string>, Undefinable<string>];
		if (scheme !== 'Bearer') {
			throw exceptionFactory(ErrorCodes.UNPROCESSABLE, `Authorization scheme needs to be 'Bearer'. Authorization header value: ${authorization}`);
		}
		if (typeof token !== 'string') {
			throw exceptionFactory(ErrorCodes.NOT_FOUND, `Can't extract access token. Authorization header value ${authorization}`);
		}
		return token;
	}

	public static isLowerCase(str: string): boolean {
		return str.toLowerCase() === str;
	}
}

export { UserSessionUtils };

import type { ApiValidator } from '@thermopylae/lib.api-validator';
import type { GeoIpLocator } from '@thermopylae/lib.geoip';
import type { AuthenticationEngine, AccountWithTotpSecret } from '@thermopylae/lib.authentication';
import type { JwtUserSessionMiddleware } from '@thermopylae/core.jwt-session';

// eslint-disable-next-line import/no-mutable-exports
let API_VALIDATOR: ApiValidator;

// eslint-disable-next-line import/no-mutable-exports
let GEOIP_LOCATOR: GeoIpLocator;

// eslint-disable-next-line import/no-mutable-exports
let AUTHENTICATION_ENGINE: AuthenticationEngine<AccountWithTotpSecret>;

// eslint-disable-next-line import/no-mutable-exports
let JWT_USER_SESSION_MIDDLEWARE: JwtUserSessionMiddleware;

export { API_VALIDATOR, GEOIP_LOCATOR, AUTHENTICATION_ENGINE, JWT_USER_SESSION_MIDDLEWARE };

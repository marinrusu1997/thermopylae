import type { Server } from 'http';
import type { ApiValidator } from '@thermopylae/lib.api-validator';
import type { GeoIpLocator } from '@thermopylae/lib.geoip';
import type { AccountWithTotpSecret, AuthenticationEngine } from '@thermopylae/lib.authentication';
import type { JwtUserSessionMiddleware } from '@thermopylae/core.jwt-session';
import type { SmsClient } from '@thermopylae/lib.sms';
import type { EmailClient } from '@thermopylae/lib.email';
import type { KafkaClient } from '../clients/kafka';
import { createException, ErrorCodes } from '../error';

// eslint-disable-next-line import/no-mutable-exports
let API_VALIDATOR: ApiValidator;

// eslint-disable-next-line import/no-mutable-exports
let GEOIP_LOCATOR: GeoIpLocator;

// eslint-disable-next-line import/no-mutable-exports
let AUTHENTICATION_ENGINE: AuthenticationEngine<AccountWithTotpSecret>;

// eslint-disable-next-line import/no-mutable-exports
let JWT_USER_SESSION_MIDDLEWARE: JwtUserSessionMiddleware;

// eslint-disable-next-line import/no-mutable-exports
let SMS_CLIENT: SmsClient;

// eslint-disable-next-line import/no-mutable-exports
let EMAIL_CLIENT: EmailClient;

// eslint-disable-next-line import/no-mutable-exports
let KAFKA_CLIENT: KafkaClient;

// eslint-disable-next-line import/no-mutable-exports
let SERVER: Server;

function initApiValidator(validator: ApiValidator): void {
	if (API_VALIDATOR != null) {
		throw createException(ErrorCodes.ALREADY_INITIALIZED, 'Api validator was initialized already.');
	}
	API_VALIDATOR = validator;
}

function initGeoipLocator(locator: GeoIpLocator): void {
	if (GEOIP_LOCATOR != null) {
		throw createException(ErrorCodes.ALREADY_INITIALIZED, 'Geo locator was initialized already.');
	}
	GEOIP_LOCATOR = locator;
}

function initAuthenticationEngine(engine: AuthenticationEngine<AccountWithTotpSecret>): void {
	if (AUTHENTICATION_ENGINE != null) {
		throw createException(ErrorCodes.ALREADY_INITIALIZED, 'Authentication engine was initialized already.');
	}
	AUTHENTICATION_ENGINE = engine;
}

function initJwtUserSessionMiddleware(middleware: JwtUserSessionMiddleware): void {
	if (JWT_USER_SESSION_MIDDLEWARE != null) {
		throw createException(ErrorCodes.ALREADY_INITIALIZED, 'Jwt user session middleware was initialized already.');
	}
	JWT_USER_SESSION_MIDDLEWARE = middleware;
}

function initSmsClient(client: SmsClient): void {
	if (SMS_CLIENT != null) {
		throw createException(ErrorCodes.ALREADY_INITIALIZED, 'Sms client was initialized already.');
	}
	SMS_CLIENT = client;
}

function initEmailClient(client: EmailClient): void {
	if (EMAIL_CLIENT != null) {
		throw createException(ErrorCodes.ALREADY_INITIALIZED, 'Email client was initialized already.');
	}
	EMAIL_CLIENT = client;
}

function initApiServer(sever: Server): void {
	if (SERVER != null) {
		throw createException(ErrorCodes.ALREADY_INITIALIZED, 'Api server was initialized already.');
	}
	SERVER = sever;
}

function initKafkaClient(client: KafkaClient): void {
	if (KAFKA_CLIENT != null) {
		throw createException(ErrorCodes.ALREADY_INITIALIZED, 'Kafka Client was initialized already.');
	}
	KAFKA_CLIENT = client;
}

export { API_VALIDATOR, GEOIP_LOCATOR, AUTHENTICATION_ENGINE, JWT_USER_SESSION_MIDDLEWARE, SMS_CLIENT, EMAIL_CLIENT, SERVER, KAFKA_CLIENT };
export {
	initApiServer,
	initApiValidator,
	initAuthenticationEngine,
	initEmailClient,
	initGeoipLocator,
	initJwtUserSessionMiddleware,
	initSmsClient,
	initKafkaClient
};

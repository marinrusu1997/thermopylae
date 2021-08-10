import { ConnectionType, DebuggableEventType, RedisConnectionOptions } from '@thermopylae/core.redis';
import { MySQLClientOptions } from '@thermopylae/core.mysql';
import { ApiValidator, ValidationError } from '@thermopylae/lib.api-validator';
import { SmsClientOptions } from '@thermopylae/lib.sms';
import { readFile } from 'jsonfile';
import path from 'path';
import { AppConfig, AuthenticationEngineConfig, EmailConfig, GeoIpConfig, JwtUserSessionMiddlewareConfig, LoggerConfig } from './typings';
import { createException, ErrorCodes } from '../error';

const enum ConfigName {
	REDIS = 'REDIS',
	MYSQL = 'MYSQL',
	GEOIP = 'GEOIP',
	AUTHENTICATION_ENGINE = 'AUTHENTICATION_ENGINE',
	EMAIL = 'EMAIL',
	SMS = 'SMS',
	LOGGER = 'LOGGER',
	JWT = 'JWT',
	APP = 'APP'
}

class Config {
	private readonly basePath: string;

	private readonly validator: ApiValidator;

	public constructor(basePath: string, validator: ApiValidator) {
		this.basePath = basePath;
		this.validator = validator;
	}

	public async getRedisConfig(): Promise<Readonly<Partial<Record<ConnectionType, RedisConnectionOptions>>>> {
		let regularOptions: RedisConnectionOptions;
		let subscriberOptions: RedisConnectionOptions;

		try {
			regularOptions = (await this.validator.validate(
				'CONFIG',
				ConfigName.REDIS,
				await readFile(path.join(this.basePath, 'redis', 'regular.json'))
			)) as RedisConnectionOptions;
		} catch (e) {
			if (e instanceof ValidationError) {
				throw createException(
					ErrorCodes.INVALID_CONFIG,
					`Redis config for ${ConnectionType.REGULAR} connection is not valid. ${this.validator.joinErrors(e.errors, 'text')}`
				);
			}
			throw e;
		}

		try {
			subscriberOptions = (await this.validator.validate(
				'CONFIG',
				ConfigName.REDIS,
				await readFile(path.join(this.basePath, 'redis', 'subscriber.json'))
			)) as RedisConnectionOptions;
		} catch (e) {
			if (e instanceof ValidationError) {
				throw createException(
					ErrorCodes.INVALID_CONFIG,
					`Redis config for ${ConnectionType.SUBSCRIBER} connection is not valid. ${this.validator.joinErrors(e.errors, 'text')}`
				);
			}
			throw e;
		}

		const config = {
			[ConnectionType.REGULAR]: regularOptions,
			[ConnectionType.SUBSCRIBER]: subscriberOptions
		};

		// @ts-ignore
		config[ConnectionType.REGULAR].attachDebugListeners = new Set(config[ConnectionType.REGULAR].attachDebugListeners as unknown as DebuggableEventType[]);
		// @ts-ignore
		config[ConnectionType.SUBSCRIBER].attachDebugListeners = new Set(
			config[ConnectionType.SUBSCRIBER].attachDebugListeners as unknown as DebuggableEventType[]
		);

		return config;
	}

	public async getMysqlConfig(): Promise<MySQLClientOptions> {
		try {
			return (await this.validator.validate('CONFIG', ConfigName.MYSQL, await readFile(path.join(this.basePath, 'mysql.json')))) as MySQLClientOptions;
		} catch (e) {
			if (e instanceof ValidationError) {
				throw createException(ErrorCodes.INVALID_CONFIG, `Mysql config is not valid. ${this.validator.joinErrors(e.errors, 'text')}`);
			}
			throw e;
		}
	}

	public async getGeoIpConfig(): Promise<GeoIpConfig> {
		try {
			return (await this.validator.validate('CONFIG', ConfigName.GEOIP, await readFile(path.join(this.basePath, 'geoip.json')))) as GeoIpConfig;
		} catch (e) {
			if (e instanceof ValidationError) {
				throw createException(ErrorCodes.INVALID_CONFIG, `GeoIP config is not valid. ${this.validator.joinErrors(e.errors, 'text')}`);
			}
			throw e;
		}
	}

	public async getEmailConfig(): Promise<EmailConfig> {
		try {
			return (await this.validator.validate('CONFIG', ConfigName.EMAIL, await readFile(path.join(this.basePath, 'email.json')))) as EmailConfig;
		} catch (e) {
			if (e instanceof ValidationError) {
				throw createException(ErrorCodes.INVALID_CONFIG, `Email config is not valid. ${this.validator.joinErrors(e.errors, 'text')}`);
			}
			throw e;
		}
	}

	public async getSmsConfig(): Promise<SmsClientOptions> {
		try {
			return (await this.validator.validate('CONFIG', ConfigName.SMS, await readFile(path.join(this.basePath, 'sms.json')))) as SmsClientOptions;
		} catch (e) {
			if (e instanceof ValidationError) {
				throw createException(ErrorCodes.INVALID_CONFIG, `Sms config is not valid. ${this.validator.joinErrors(e.errors, 'text')}`);
			}
			throw e;
		}
	}

	public async getLoggingConfig(): Promise<LoggerConfig> {
		try {
			return (await this.validator.validate('CONFIG', ConfigName.LOGGER, await readFile(path.join(this.basePath, 'logger.json')))) as LoggerConfig;
		} catch (e) {
			if (e instanceof ValidationError) {
				throw createException(ErrorCodes.INVALID_CONFIG, `Logging config is not valid. ${this.validator.joinErrors(e.errors, 'text')}`);
			}
			throw e;
		}
	}

	public async getJwtUserSessionMiddlewareConfig(): Promise<JwtUserSessionMiddlewareConfig> {
		try {
			return (await this.validator.validate(
				'CONFIG',
				ConfigName.JWT,
				await readFile(path.join(this.basePath, 'jwt.json'))
			)) as JwtUserSessionMiddlewareConfig;
		} catch (e) {
			if (e instanceof ValidationError) {
				throw createException(
					ErrorCodes.INVALID_CONFIG,
					`Jwt user session middleware config is not valid. ${this.validator.joinErrors(e.errors, 'text')}`
				);
			}
			throw e;
		}
	}

	public async getAppConfig(): Promise<AppConfig> {
		try {
			return (await this.validator.validate('CONFIG', ConfigName.APP, await readFile(path.join(this.basePath, 'app.json')))) as AppConfig;
		} catch (e) {
			if (e instanceof ValidationError) {
				throw createException(ErrorCodes.INVALID_CONFIG, `App config is not valid. ${this.validator.joinErrors(e.errors, 'text')}`);
			}
			throw e;
		}
	}

	public async getAuthenticationEngineConfig(): Promise<AuthenticationEngineConfig> {
		try {
			return (await this.validator.validate(
				'CONFIG',
				ConfigName.AUTHENTICATION_ENGINE,
				await readFile(path.join(this.basePath, 'authentication.json'))
			)) as AuthenticationEngineConfig;
		} catch (e) {
			if (e instanceof ValidationError) {
				throw createException(ErrorCodes.INVALID_CONFIG, `Authentication engine config is not valid. ${this.validator.joinErrors(e.errors, 'text')}`);
			}
			throw e;
		}
	}
}

export { Config };

import { ConnectionType, RedisClientOptions, DebuggableEventType } from '@thermopylae/core.redis';
import { MySQLClientOptions } from '@thermopylae/core.mysql';
import { ApiValidator } from '@thermopylae/lib.api-validator';
import { SmsClientOptions } from '@thermopylae/lib.sms';
import { readFile } from 'jsonfile';
import path from 'path';
import { AppConfig, AuthenticationEngineConfig, EmailConfig, GeoIpConfig, JwtUserSessionMiddlewareConfig, LoggerConfig } from './typings';

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

	public async getRedisConfig(): Promise<Readonly<Partial<Record<ConnectionType, RedisClientOptions>>>> {
		const config = {
			[ConnectionType.REGULAR]: (await this.validator.validate(
				'CONFIG',
				ConfigName.REDIS,
				await readFile(path.join(this.basePath, 'redis', 'regular.json'))
			)) as RedisClientOptions,
			[ConnectionType.SUBSCRIBER]: (await this.validator.validate(
				'CONFIG',
				ConfigName.REDIS,
				await readFile(path.join(this.basePath, 'redis', 'subscriber.json'))
			)) as RedisClientOptions
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
		return (await this.validator.validate('CONFIG', ConfigName.MYSQL, await readFile(path.join(this.basePath, 'mysql.json')))) as MySQLClientOptions;
	}

	public async getGeoIpConfig(): Promise<GeoIpConfig> {
		return (await this.validator.validate('CONFIG', ConfigName.GEOIP, await readFile(path.join(this.basePath, 'geoip.json')))) as GeoIpConfig;
	}

	public async getEmailConfig(): Promise<EmailConfig> {
		return (await this.validator.validate('CONFIG', ConfigName.EMAIL, await readFile(path.join(this.basePath, 'email.json')))) as EmailConfig;
	}

	public async getSmsConfig(): Promise<SmsClientOptions> {
		return (await this.validator.validate('CONFIG', ConfigName.SMS, await readFile(path.join(this.basePath, 'sms.json')))) as SmsClientOptions;
	}

	public async getLoggingConfig(): Promise<LoggerConfig> {
		return (await this.validator.validate('CONFIG', ConfigName.LOGGER, await readFile(path.join(this.basePath, 'logger.json')))) as LoggerConfig;
	}

	public async getJwtUserSessionMiddlewareConfig(): Promise<JwtUserSessionMiddlewareConfig> {
		return (await this.validator.validate(
			'CONFIG',
			ConfigName.JWT,
			await readFile(path.join(this.basePath, 'jwt.json'))
		)) as JwtUserSessionMiddlewareConfig;
	}

	public async getAppConfig(): Promise<AppConfig> {
		return (await this.validator.validate('CONFIG', ConfigName.APP, await readFile(path.join(this.basePath, 'app.json')))) as AppConfig;
	}

	public async getAuthenticationEngineConfig(): Promise<AuthenticationEngineConfig> {
		return (await this.validator.validate(
			'CONFIG',
			ConfigName.AUTHENTICATION_ENGINE,
			await readFile(path.join(this.basePath, 'authentication.json'))
		)) as AuthenticationEngineConfig;
	}
}

export { Config };

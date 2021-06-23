import { ObjMap } from '@thermopylae/core.declarations';
import { ConnectionType, RedisClientOptions } from '@thermopylae/core.redis';
import { MySQLClientOptions } from '@thermopylae/core.mysql';
import { ApiValidator } from '@thermopylae/lib.api-validator';
import { SmsClientOptions } from '@thermopylae/lib.sms';
import { readFile } from 'jsonfile';
import path from 'path';
import { AuthenticationEngineConfig, EmailConfig, GeoIpConfig, LoggerConfig } from './typings';

const enum ConfigName {
	REDIS = 'REDIS',
	MYSQL = 'MYSQL',
	GEOIP = 'GEOIP',
	AUTHENTICATION_ENGINE = 'AUTHENTICATION_ENGINE',
	EMAIL = 'EMAIL',
	SMS = 'SMS',
	LOGGER = 'LOGGER'
}

class Config {
	private readonly basePath: string;

	private readonly validator: ApiValidator;

	private readonly configs: Map<ConfigName, ObjMap>;

	public constructor(basePath: string, validator: ApiValidator) {
		this.basePath = basePath;
		this.validator = validator;
		this.configs = new Map<ConfigName, ObjMap>();
	}

	public async getRedisConfig(): Promise<Readonly<Partial<Record<ConnectionType, RedisClientOptions>>>> {
		let config = this.configs.get(ConfigName.REDIS) as Readonly<Partial<Record<ConnectionType, RedisClientOptions>>>;

		if (config == null) {
			config = {
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

			this.configs.set(ConfigName.REDIS, config);
		}

		return config;
	}

	public async getMysqlConfig(): Promise<MySQLClientOptions> {
		let config = this.configs.get(ConfigName.MYSQL) as MySQLClientOptions;

		if (config == null) {
			config = (await this.validator.validate('CONFIG', ConfigName.MYSQL, await readFile(path.join(this.basePath, 'mysql.json')))) as MySQLClientOptions;
			this.configs.set(ConfigName.MYSQL, config);
		}

		return config;
	}

	public async getGeoIpConfig(): Promise<GeoIpConfig> {
		let config = this.configs.get(ConfigName.GEOIP) as GeoIpConfig;

		if (config == null) {
			config = (await this.validator.validate('CONFIG', ConfigName.GEOIP, await readFile(path.join(this.basePath, 'geoip.json')))) as GeoIpConfig;
			this.configs.set(ConfigName.GEOIP, config);
		}

		return config;
	}

	public async getEmailConfig(): Promise<EmailConfig> {
		let config = this.configs.get(ConfigName.EMAIL) as EmailConfig;

		if (config == null) {
			config = (await this.validator.validate('CONFIG', ConfigName.EMAIL, await readFile(path.join(this.basePath, 'email.json')))) as EmailConfig;
			this.configs.set(ConfigName.EMAIL, config);
		}

		return config;
	}

	public async getSmsConfig(): Promise<SmsClientOptions> {
		let config = this.configs.get(ConfigName.SMS) as SmsClientOptions;

		if (config == null) {
			config = (await this.validator.validate('CONFIG', ConfigName.SMS, await readFile(path.join(this.basePath, 'sms.json')))) as SmsClientOptions;
			this.configs.set(ConfigName.SMS, config);
		}

		return config;
	}

	public async getLoggingConfig(): Promise<LoggerConfig> {
		return (await this.validator.validate('CONFIG', ConfigName.LOGGER, await readFile(path.join(this.basePath, 'logger.json')))) as LoggerConfig;
	}

	public async getAuthenticationEngineConfig(): Promise<AuthenticationEngineConfig> {
		let config = this.configs.get(ConfigName.AUTHENTICATION_ENGINE) as AuthenticationEngineConfig;

		if (config == null) {
			config = (await this.validator.validate(
				'CONFIG',
				ConfigName.AUTHENTICATION_ENGINE,
				await readFile(path.join(this.basePath, 'authentication.json'))
			)) as AuthenticationEngineConfig;

			this.configs.set(ConfigName.AUTHENTICATION_ENGINE, config);
		}

		return config;
	}
}

export { Config };

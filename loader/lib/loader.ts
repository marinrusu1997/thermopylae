import {
	ConfigurableModule,
	Configuration,
	GeneralConfig,
	LibEmailConfig,
	LibFirewallConfig,
	LibGeoIpConfig,
	LibJwtConfig,
	LibLoggerConfig,
	LibSmsConfig,
	RedisConfig
} from '@marin/configuration';
import { getRedisClient, initRedisClient, RedisClient } from '@marin/data-repositories';
import LoggerInstance from '@marin/lib.logger';
import { EmailClient } from '@marin/lib.email';
import { SmsClient } from '@marin/lib.sms';
import { Firewall } from '@marin/lib.firewall';
import { GeoIP } from '@marin/lib.geoip';
import { Jwt, RedisStorage } from '@marin/lib.jwt';
import { job } from 'cron';
import { getLogger } from './logger';
import { sendNotificationGeoIpLiteDbReloadedToAdminEmail } from './email';

class Loader {
	private readonly config: Configuration;

	constructor(config: Configuration) {
		this.config = config;
	}

	public async load(): Promise<void> {
		// FIXME boot as fast as possible
		const generalConfig = (await this.config.for(ConfigurableModule.GENERAL)) as GeneralConfig;
		// logger is the first who needs to be loaded, other modules might need it in order to report init failures
		await this.initLogger();

		// connect to data repositories in parallel
		const [redisClient] = await Promise.all([this.initRedis.bind(this)]);

		// if connected successfully, load other systems
		const [emailClient, smsClient, jwtInstance] = await Promise.all([
			this.initEmail.bind(this),
			this.initSms.bind(this),
			this.initJwt.bind(this),
			this.initFirewall.bind(this)
		]);

		const geoIp = await this.initGeoIp(emailClient, generalConfig.contacts.adminEmail);
	}

	private async initLogger(): Promise<void> {
		const config = (await this.config.for(ConfigurableModule.LIB_LOGGER)) as LibLoggerConfig;
		LoggerInstance.formatting.applyOrderFor(config.formatting.output, config.formatting.colorize);

		if (config.console) {
			LoggerInstance.console.setConfig(config.console);
		}

		if (config.file) {
			LoggerInstance.file.setConfig(config.file);
		}

		if (config.graylog2) {
			for (let i = 0; i < config.graylog2.inputs.length; i++) {
				LoggerInstance.graylog2.register(config.graylog2.inputs[i].name, config.graylog2.inputs[i].server);
			}

			for (let i = 0; i < config.graylog2.recipes.length; i++) {
				LoggerInstance.graylog2.recipeFor(config.graylog2.recipes[i].system, config.graylog2.recipes[i].recipe);
			}
		}
	}

	private async initFirewall(): Promise<void> {
		const firewallConfig = (await this.config.for(ConfigurableModule.LIB_FIREWALL)) as LibFirewallConfig;
		await Firewall.init(firewallConfig.validationSchemasDir, firewallConfig.excludeDirs);
	}

	private async initEmail(): Promise<EmailClient> {
		const emailConfig = (await this.config.for(ConfigurableModule.LIB_EMAIL)) as LibEmailConfig;
		return new EmailClient(emailConfig.options, emailConfig.defaults);
	}

	private async initSms(): Promise<SmsClient> {
		return new SmsClient((await this.config.for(ConfigurableModule.LIB_SMS)) as LibSmsConfig);
	}

	private async initGeoIp(mailer: EmailClient, adminEmail: string): Promise<GeoIP> {
		const geoIpConfig = (await this.config.for(ConfigurableModule.LIB_GEO_IP)) as LibGeoIpConfig;
		const geoIp = new GeoIP(geoIpConfig.ipStackAPIKey);

		function onTickHandler(onComplete: (status?: boolean) => void): void {
			GeoIP.refresh()
				.then(() => onComplete(true))
				.catch(err => getLogger().error('Failed to reload local geoip-lite db. ', err));
		}

		function onCompleteHandler(success?: boolean): void {
			if (success) {
				getLogger().info('Local geoip-lite db reloaded successfully.');
				sendNotificationGeoIpLiteDbReloadedToAdminEmail(mailer, adminEmail, 'success').catch(err =>
					getLogger().error('Failed to notify admin about reloading of geoip-lite db.', err)
				);
				return;
			}
			getLogger().warning('Local geoip-lite db was not reloaded.');
			sendNotificationGeoIpLiteDbReloadedToAdminEmail(mailer, adminEmail, 'failure').catch(err =>
				getLogger().error('Failed to notify admin about reloading of geoip-lite db.', err)
			);
		}

		// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
		// @ts-ignore
		job(geoIpConfig.reloadLocalDbCronPattern || '0 0 0 1 * *', onTickHandler, onCompleteHandler, true);

		return geoIp;
	}

	private async initRedis(): Promise<RedisClient> {
		const redisConfig = (await this.config.for(ConfigurableModule.REDIS)) as RedisConfig;
		await initRedisClient(redisConfig, redisConfig.debug, redisConfig.monitor);
		return getRedisClient();
	}

	private async initJwt(): Promise<Jwt> {
		const jwtConfig = (await this.config.for(ConfigurableModule.LIB_JWT)) as LibJwtConfig;
		const jwt = new Jwt({
			secret: jwtConfig.secret,
			blacklisting: true,
			signVerifyOpts: jwtConfig.signVerifyOpts
		});
		await jwt.blacklist().init(
			new RedisStorage({
				redis: getRedisClient(),
				keyPrefix: jwtConfig.redisStorage.keyPrefix,
				clean: jwtConfig.redisStorage.cleanExpiredTokensOnBlacklisting
			})
		);
		return jwt;
	}
}

export { Loader };

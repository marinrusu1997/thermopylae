import { Seconds, Threshold, RequireAtLeastOne, PublicPrivateKeys } from '@thermopylae/core.declarations';
import { Argon2PasswordHashingOptions, TotpTwoFactorAuthStrategyOptions } from '@thermopylae/lib.authentication';
import { DefaultFormatters, GraylogEndpoint, GraylogLoggingChannel, OutputFormat } from '@thermopylae/core.logger';
// eslint-disable-next-line import/extensions,node/no-extraneous-import,import/no-extraneous-dependencies
import type { SyslogConfigSetLevels } from 'winston/lib/winston/config';
// eslint-disable-next-line node/no-extraneous-import
import type { Algorithm } from 'jsonwebtoken';
import type { UserSessionOptions } from '@thermopylae/core.jwt-session';

interface GeoIpConfig {
	readonly GEOIP_LITE: {
		readonly weight: number;
	};
	readonly IPLOCATE: {
		readonly apiKey?: string;
		readonly weight: number;
	};
	readonly IPSTACK: {
		readonly apiKey: string;
		readonly proto: 'http' | 'https';
		readonly lang: 'en' | 'de' | 'es' | 'fr' | 'ja' | 'pt-br' | 'ru' | 'zh';
		readonly weight: number;
	};
}

interface EmailConfig {
	transport: {
		options: {
			service: string;
			auth: {
				type: 'OAuth2';
				user: string;
				clientId: string;
				clientSecret: string;
				refreshToken: string;
				accessToken: string;
			};
		};
		defaults: {
			from: string;
		};
	};
}

interface LoggerConfig {
	transports: RequireAtLeastOne<
		{
			CONSOLE?: {
				level: string;
				silent?: boolean;
				consoleWarnLevels: string[];
				stderrLevels: string[];
				debugStdout?: boolean;
			};
			FILE?: {
				level: string;
				silent?: boolean;
				datePattern: string;
				zippedArchive: boolean;
				filename: string;
				dirname: string;
				maxSize: string | number;
				maxFiles: string | number;
				auditFile: string;
				frequency: string;
				utc?: boolean;
				extension: string;
				createSymlink?: boolean;
				symlinkName?: string;
			};
			GRAYLOG2?: {
				endpoints: {
					[Endpoint: string]: GraylogEndpoint;
				};
				channels: {
					[Channel: string]: GraylogLoggingChannel;
				};
			};
		},
		'CONSOLE' | 'FILE' | 'GRAYLOG2'
	>;
	formatting: {
		format: OutputFormat;
		colorize?: boolean;
		ignoredLabels?: Array<string>;
		levelForLabel?: Readonly<Record<string, keyof SyslogConfigSetLevels>>;
		skippedFormatters?: Array<DefaultFormatters.TIMESTAMP | DefaultFormatters.ERRORS | DefaultFormatters.ALIGN | string>;
	};
}

interface JwtUserSessionMiddlewareConfig {
	jwt: {
		secret: string | PublicPrivateKeys;
		invalidationOptions: {
			refreshTokenLength: number;
			refreshTokenTtl: Seconds;
			refreshTokensStorage: {
				keyPrefix: {
					sessions: string;
					sessionId: string;
				};
				concurrentSessions: number;
			};
		};
		signOptions: {
			algorithm: Algorithm;
			expiresIn: Seconds;
			audience: string;
			issuer: string;
		};
		verifyOptions: {
			algorithms: Algorithm[];
			audience: string;
			issuer: string;
		};
	};
	session: UserSessionOptions;
}

interface AppConfig {
	listen: {
		host: string;
		port: number;
	};
	api: {
		path: {
			base: string;
			authentication: string;
			session: string;
		};
	};
}

interface AuthenticationEngineConfig {
	readonly thresholds: {
		readonly maxFailedAuthAttempts: Threshold;
		readonly failedAuthAttemptsRecaptcha: Threshold;
	};
	readonly ttl: {
		readonly authenticationSession: Seconds;
		readonly failedAuthAttemptsSession: Seconds;
		readonly activateAccountSession: Seconds;
		readonly forgotPasswordSession: Seconds;
		readonly accountDisableTimeout: Seconds;
	};
	readonly repositories: {
		readonly activateAccountSessionKeyPrefix: string;
		readonly authenticationSessionKeyPrefix: string;
		readonly failedAuthAttemptsSessionKeyPrefix: string;
		readonly forgotPasswordSessionKeyPrefix: string;
	};
	readonly recaptcha: {
		readonly secretKey: string;
		readonly score: number;
		readonly hostname: string;
	};
	readonly password: {
		readonly encryption: false;
		readonly minLength: number;
		readonly maxLength: number;
		readonly breachThreshold: number;
		readonly similarity: number;
		readonly hashing: Argon2PasswordHashingOptions;
	};
	readonly adminEmail: string;
	readonly '2faStrategy': TotpTwoFactorAuthStrategyOptions;
	readonly tokensLength: number;
}

export { GeoIpConfig, EmailConfig, LoggerConfig, JwtUserSessionMiddlewareConfig, AuthenticationEngineConfig, AppConfig };

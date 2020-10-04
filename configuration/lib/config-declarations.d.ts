import { FormattingManager, GrayLogsManager } from '../../lib.logger.bk';

export interface GeneralConfig {
	contacts: {
		adminEmail: string;
	};
}

export interface LibAuthEngineConfig {
	jwt: {
		rolesTtl: Map<string, number>; // role -> seconds
	};
	secrets: {
		totp: string;
	};
	passwordHasher: {
		hashingAlg: number;
		pepper: string;
	};
}

export interface LibEmailConfig {
	defaults: {
		from: string;
	};
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
		port: number;

		secure: boolean;
		requireTLS: boolean;

		pool: boolean;
		maxConnections: number;
		maxMessages: number;

		disableFileAccess: boolean;
		disableUrlAccess: boolean;
	};
}

export interface LibFirewallConfig {
	validationSchemasDir: string;
	excludeDirs: Array<string>;
}

export interface LibGeoIpConfig {
	ipStackAPIKey: string;
	reloadLocalDbCronPattern?: string; // according to https://www.npmjs.com/package/cron
}

export type JwtAlgType = 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512' | 'ES256' | 'ES384' | 'ES512';

export interface LibJwtConfig {
	secret: {
		pub: string;
		priv: string;
	};
	signVerifyOpts: {
		sign: {
			algorithm: JwtAlgType;
			issuer: string;
			mutatePayload: boolean;
		};
		verify: {
			algorithms: Array<JwtAlgType>;
			audience: Array<string>;
			issuer: string;
		};
	};
	redisStorage: {
		keyPrefix: string;
		cleanExpiredTokensOnBlacklisting: boolean;
	};
}

export type SysLogLevel = 'emerg' | 'alert' | 'crit' | 'error' | 'warning' | 'notice' | 'info' | 'debug';

export interface LibLoggerConfig {
	formatting: {
		output: FormattingManager.OutputFormat;
		colorize: true;
	};
	console?: {
		level: SysLogLevel;
	};
	file?: {
		level: SysLogLevel;
		zippedArchive: boolean;
		filename: string; // can include the %DATE% placeholder which will include the formatted datePattern at that point in the filename
		dirname: string;
		auditFile: string; // needs to contain `dirname` in his path
		extension: string;
		createSymlink: boolean;
		symlinkName: string;
	};
	graylog2?: {
		inputs: Array<{ name: string; server: GrayLogsManager.IGraylogServer }>;
		recipes: Array<{ system: string | '@all'; recipe: GrayLogsManager.IRecipe }>;
	};
}

export interface LibSmsConfig {
	accountSid: string;
	authToken: string;
	fromNumber: string;
}

export interface MySqlConnectionConfig {
	host: string;
	port: number;
	localAddress?: string;
	socketPath?: string;
	user: string;
	password: string;
	database: string;
	stringifyObjects: boolean; // see https://github.com/mysqljs/mysql/issues/501
	debug: boolean;
	trace: boolean;
	supportBigNumbers: boolean;
	bigNumberStrings: boolean;
}

export interface MySqlPoolConfig extends MySqlConnectionConfig {
	acquireTimeout: number; // milliseconds
	waitForConnections: boolean;
	connectionLimit: number;
	queueLimit: number;
}

export interface MySqlClientConfig {
	// see https://www.npmjs.com/package/mysql
	pool?: MySqlPoolConfig;
	sessionVariablesQueries?: Array<string>;
	poolCluster?: {
		cluster: {
			canRetry: boolean;
			removeNodeErrorCount: number;
			restoreNodeTimeout: number; // milliseconds, setting this will cause node to never be removed!!!
			defaultSelector: string; // 'RR' | 'RANDOM' | 'ORDER'
		};
		pools: {
			[name: string]: MySqlPoolConfig;
		};
	};
}

export interface RedisClientConfig {
	// see https://www.npmjs.com/package/redis
	host?: string;
	port?: number;
	path?: string;
	url?: string;
	parser?: string;
	string_numbers?: boolean;
	return_buffers?: boolean;
	detect_buffers?: boolean;
	socket_keepalive?: boolean;
	socket_initialdelay?: number;
	no_ready_check?: boolean;
	enable_offline_queue?: boolean;
	retry_max_delay?: number;
	connect_timeout?: number;
	max_attempts?: number;
	retry_unfulfilled_commands?: boolean;
	auth_pass?: string;
	password?: string;
	db?: string | number;
	family?: string;
	rename_commands?: { [command: string]: string } | null;
	tls?: any;
	prefix?: string;
	debug?: boolean;
	monitor?: boolean;
}

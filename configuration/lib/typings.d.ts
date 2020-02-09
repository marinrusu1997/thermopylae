export interface AppConfigLocations {
	basePath?: string;
	libs: {
		logger: string;
		email: string;
		sms: string;
		firewall: string;
		geoIp: string;
		restApi: string;

		authEngine: string;

		jwt: string;
	};
	dataRepositories: {
		mysql: string;
		redis: string;
	};
	general: string;
}

export const enum ConfigurableModule {
	LIB_AUTH_ENGINE = 'LIB_AUTH_ENGINE',
	LIB_EMAIL = 'LIB_EMAIL',
	LIB_FIREWALL = 'LIB_FIREWALL',
	LIB_GEO_IP = 'LIB_GEO_IP',
	LIB_JWT = 'LIB_JWT',
	LIB_LOGGER = 'LIB_LOGGER',
	LIB_REST_API = 'LIB_REST_API',
	LIB_SMS = 'LIB_SMS',

	MYSQL = 'MYSQL',
	REDIS = 'REDIS',

	GENERAL = 'GENERAL'
}

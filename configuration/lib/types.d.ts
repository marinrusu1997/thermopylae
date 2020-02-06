export interface AppConfigLocations {
	basePath: string;
	libs: {
		authEngine: string;
		firewall: string;
		geo_ip: string;
		jwt: string;
		logger: string;
		restApi: string;
		email: string;
		sms: string;
	};
	dataRepositories: {
		mysql: string;
		redis: string;
	};
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
	REDIS = 'REDIS'
}

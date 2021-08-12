import { RouterOptions } from 'express';

const enum ServiceMethod {
	AUTHENTICATE = 'AUTHENTICATE',
	REGISTER = 'REGISTER',
	SET_TWO_FACTOR_AUTH_ENABLED = 'SET_TWO_FACTOR_AUTH_ENABLED',
	CHANGE_PASSWORD = 'CHANGE_PASSWORD',
	CREATE_FORGOT_PASSWORD_SESSION = 'CREATE_FORGOT_PASSWORD_SESSION',
	CHANGE_FORGOTTEN_PASSWORD = 'CHANGE_FORGOTTEN_PASSWORD',
	REFRESH_USER_SESSION = 'REFRESH_USER_SESSION',
	LOGOUT_ONE = 'LOGOUT_ONE'
}

const enum EnvironmentVariables {
	CONFIG_FILES_PATH = 'CONFIG_FILES_PATH'
}

const enum ApplicationServices {
	AUTHENTICATION = 'AUTH_SERVICE',
	KAFKA = 'KAFKA_CLIENT'
}

// 'INSTANCE_ID' env var might be injected by PM2
const APP_NODE_ID = typeof process.env['INSTANCE_ID'] === 'string' ? process.env['INSTANCE_ID'] : String(process.pid);

const REQUEST_USER_SESSION_SYM = Symbol('REQUEST_USER_SESSION_SYM');

const ROUTER_OPTIONS: RouterOptions = {
	caseSensitive: true,
	mergeParams: false,
	strict: true
};
Object.freeze(ROUTER_OPTIONS);

export { ApplicationServices, ServiceMethod, EnvironmentVariables, APP_NODE_ID, REQUEST_USER_SESSION_SYM, ROUTER_OPTIONS };

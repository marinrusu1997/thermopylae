const enum ServiceMethod {
	AUTHENTICATE = 'AUTHENTICATE'
}

const enum EnvironmentVariables {
	CONFIG_FILES_PATH = 'CONFIG_FILES_PATH'
}

const SERVICE_NAME = 'AUTH_SERVICE';

const REQUEST_SESSION_SYM = Symbol('REQUEST_SESSION_SYM');

export { SERVICE_NAME, REQUEST_SESSION_SYM, ServiceMethod, EnvironmentVariables };

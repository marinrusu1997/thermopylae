/**
 * Thermopylae framework libraries.
 */
export const enum Library {
	ASYNC = 'LIB_ASYNC',
	AUTHENTICATION = 'LIB_AUTHENTICATION',
	CACHE = 'LIB_CACHE',
	INDEXED_STORE = 'LIB_INDEXED_STORE',
	COLLECTION = 'LIB_COLLECTION',
	HEAP = 'LIB_HEAP',
	GEO_IP = 'LIB_GEO_IP',
	JWT_USER_SESSION = 'LIB_JWT_USER_SESSION',
	POOL = 'LIB_POOL',
	USER_SESSION = 'LIB_USER_SESSION',
	UTILS = 'LIB_UTILS'
}

/**
 * Thermopylae framework core modules.
 */
export const enum CoreModule {
	AUTHENTICATION = 'CORE_AUTHENTICATION',
	USER_SESSION_COMMONS = 'CORE_USER_SESSION',
	JWT_USER_SESSION = 'CORE_JWT_SESSION',
	COOKIE_USER_SESSION = 'CORE_COOKIE_SESSION'
}

/**
 * Thermopylae framework development modules.
 */
export const enum DevModule {
	ENVIRONMENT = 'DEV_ENVIRONMENT',
	UNIT_TESTING = 'DEV_UNIT_TESTING'
}

/**
 * Thermopylae framework client modules.
 */
export const enum ClientModule {
	SMS = 'SMS_CLIENT',
	EMAIL = 'EMAIL_CLIENT',
	REDIS = 'REDIS_CLIENT',
	MYSQL = 'MYSQL_CLIENT'
}

/**
 * Flag which indicates operation/process status.
 */
export const enum StatusFlag {
	ENABLED,
	DISABLED,
	IDLE
}

export const enum SortDirection {
	ASCENDING,
	DESCENDING
}

export const enum ComparisonResult {
	GREATER = 1,
	EQUALS = 0,
	SMALLER = -1
}

/**
 * Type of the concurrency when processing items.
 */
export const enum ConcurrencyType {
	SEQUENTIAL,
	PARALLEL,
	BATCH
}

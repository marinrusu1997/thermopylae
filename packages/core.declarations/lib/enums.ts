/** Thermopylae framework libraries. */
enum Library {
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

/** Thermopylae framework core modules. */
enum CoreModule {
	AUTHENTICATION = 'CORE_AUTHENTICATION',
	USER_SESSION_COMMONS = 'CORE_USER_SESSION',
	JWT_USER_SESSION = 'CORE_JWT_SESSION',
	COOKIE_USER_SESSION = 'CORE_COOKIE_SESSION',
	LOGGER = 'CORE_LOGGER'
}

/** Thermopylae framework development modules. */
enum DevModule {
	ENVIRONMENT = 'DEV_ENVIRONMENT',
	UNIT_TESTING = 'DEV_UNIT_TESTING'
}

/** Thermopylae framework client modules. */
enum ClientModule {
	SMS = 'SMS_CLIENT',
	EMAIL = 'EMAIL_CLIENT',
	REDIS = 'REDIS_CLIENT',
	MYSQL = 'MYSQL_CLIENT'
}

/** Flag which indicates operation/process status. */
enum StatusFlag {
	ENABLED = 0,
	DISABLED = 1,
	IDLE = 2
}

enum SortDirection {
	ASCENDING = 0,
	DESCENDING = 1
}

enum ComparisonResult {
	GREATER = 1,
	EQUALS = 0,
	SMALLER = -1
}

/** Type of the concurrency when processing items. */
enum ConcurrencyType {
	SEQUENTIAL = 0,
	PARALLEL = 1,
	BATCH = 2
}

export { Library, CoreModule, DevModule, ClientModule, StatusFlag, SortDirection, ComparisonResult, ConcurrencyType };

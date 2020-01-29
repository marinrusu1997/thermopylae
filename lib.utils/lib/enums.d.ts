export const enum Libraries {
	AUTH_ENGINE = 'AUTH_ENGINE_LIB',
	EMAIL = 'EMAIL_LIB',
	GEO_IP = 'GEO_IP_LIB',
	LOGGER = 'LOGGER_LIB',
	MEM_CACHE = 'MEM_CACHE_LIB',
	SMS = 'SMS_LIB',
	REST_API = 'REST_API_LIB',
	UTILS = 'UTILS_LIB'
}

export const enum AuthTokenType {
	BASIC = 'BASIC',
	OAUTH = 'OAUTH',
	GOOGLE = 'GOOGLE',
	FACEBOOK = 'FACEBOOK'
}

export const enum HttpMethod {
	GET = 'GET',
	HEAD = 'HEAD',
	POST = 'POST',
	PUT = 'PUT',
	DELETE = 'DELETE',
	CONNECT = 'CONNECT',
	OPTIONS = 'OPTIONS',
	TRACE = 'TRACE',
	PATCH = 'PATCH'
}

export const enum HttpStatusCode {
	OK = 200,
	ACCEPTED = 202,
	NO_CONTENT = 204,

	BAD_REQUEST = 400,
	UNAUTHORIZED = 401,
	FORBIDDEN = 403,
	NOT_FOUND = 404,
	GONE = 410
}

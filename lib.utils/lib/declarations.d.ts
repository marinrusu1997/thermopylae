export const enum Libraries {
	AUTH_ENGINE = 'LIB_AUTH_ENGINE',
	EMAIL = 'LIB_EMAIL',
	GEO_IP = 'LIB_GEO_IP',
	LOGGER = 'LIB_LOGGER',
	MEM_CACHE = 'LIB_MEM_CACHE',
	SMS = 'LIB_SMS',
	REST_API = 'LIB_REST_API',
	UTILS = 'LIB_UTILS'
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
	CONFLICT = 409,
	GONE = 410
}

export type AsyncFunction<I = any, O = any> = (...args: Array<I>) => Promise<O>;
export type UnaryPredicate<T> = (val: T) => boolean;
export type UnaryPredicateAsync<T> = (val: T) => Promise<boolean>;
export type BinaryPredicate<T, V> = (first: T, second: V) => boolean;
export type BinaryPredicateAsync<T, V> = (first: T, second: V) => Promise<boolean>;

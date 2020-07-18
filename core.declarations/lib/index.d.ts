export interface PublicPrivateKeys {
	readonly private: string | Buffer;
	readonly public: string | Buffer;
}

export interface SessionTokens {
	readonly accessToken: string;
	readonly refreshToken?: string;
}

export interface PromiseHolder<T> {
	promise: Promise<T>;
	resolve: PromiseResolve<T>;
	reject: PromiseReject;
}

export interface Cloneable<T> {
	clone(): T;
}

export interface Comparable<T> {
	compare(other: T): ComparisonResult;
}

export interface Same<T> {
	equals(other: T): boolean;
}

export interface Identity {
	hashCode(): string;
}

export const enum Library {
	ASYNC = 'LIB_ASYNC',
	CACHE = 'LIB_CACHE',
	COLLECTIONS = 'LIB_COLLECTIONS',
	GEO_IP = 'LIB_GEO_IP',
	LOGGER = 'LIB_LOGGER',
	POOL = 'LIB_POOL',
	UTILS = 'LIB_UTILS'
}

export const enum CoreModule {
	JWT = 'CORE_JWT',
	AUTH_ENGINE = 'CORE_AUTH_ENGINE',
	REST_API = 'CORE_REST_API'
}

export const enum Client {
	SMS = 'SMS_CLIENT',
	EMAIL = 'EMAIL_CLIENT',
	REDIS = 'REDIS_CLIENT',
	MYSQL = 'MYSQL_CLIENT'
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

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
	{
		[K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
	}[Keys];

export type RequireOnlyOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
	{
		[K in Keys]-?: Required<Pick<T, K>> & Partial<Record<Exclude<Keys, K>, undefined>>;
	}[Keys];

export type Conditional<Dispatcher, Expectation, Truthy, Falsy> = Dispatcher extends Expectation ? Truthy : Falsy;

export type Nullable<T> = T | null;
export type Undefinable<T> = T | undefined;
export type Voidable<T> = T | void;
export type Optional<T> = Nullable<Undefinable<Voidable<T>>>;

export type RecordKey = string | number | symbol;
export type PersistableRecordKey = Exclude<RecordKey, symbol>;

export type Primitive = boolean | number | string | bigint;
export type PersistablePrimitive = Nullable<Primitive>;

export type PersistableObjMap = Record<PersistableRecordKey, PersistablePrimitive | { [Key in PersistableRecordKey]: PersistableObjMap }>;

export type SyncFunction<I = any, O = any> = (...args: Array<I>) => O;
export type AsyncFunction<I = any, O = any> = (...args: Array<I>) => Promise<O>;

export type UnaryPredicate<T> = (val: T) => boolean;
export type UnaryPredicateAsync<T> = (val: T) => Promise<boolean>;
export type BinaryPredicate<T, V> = (first: T, second: V) => boolean;
export type BinaryPredicateAsync<T, V> = (first: T, second: V) => Promise<boolean>;

export type PromiseResolve<T> = (value?: T | PromiseLike<T>) => void;
export type PromiseReject = (reason?: any) => void;

export type UnixTimestamp = number;
export type Milliseconds = number;
export type Seconds = number;
export type Minutes = number;

export type Threshold = number;

export type Label = string;
export type Index = number;

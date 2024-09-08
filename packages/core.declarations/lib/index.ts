export type {
	ObjMap,
	Seconds,
	UnixTimestamp,
	Hours,
	Index,
	Label,
	PersistableObjMap,
	PersistablePrimitive,
	Primitive,
	Milliseconds,
	Minutes,
	PersistableRecordKey,
	RecordKey,
	PackageID,
	Percentage,
	Threshold
} from './aliases';
export { ClientModule, CoreModule, DevModule, Library, ComparisonResult, ConcurrencyType, SortDirection, StatusFlag } from './enums';
export type { Same, Cloneable, Comparable, Identity } from './functional';
export type {
	Comparator,
	PromiseReject,
	PromiseResolve,
	AsyncFunction,
	AsyncMapper,
	Mapper,
	BinaryPredicate,
	BinaryPredicateAsync,
	UnaryPredicateAsync,
	UnaryPredicate,
	Equals,
	Processor,
	SyncFunction,
	Runnable
} from './functions';

export type { ClientType, HttpDeviceClient, HttpDeviceOs, HttpDevice, DeviceType, HttpDeviceDetector } from './http/device';
export type { HTTPRequestLocation } from './http/location';
export { MimeType, MimeExt } from './http/mime';
export type { HttpResponse } from './http/response';
export type { HttpRequestHeader, NonStandardHttpRequestHeaders, StandardHttpRequestHeaders } from './http/request-headers';
export { HttpRequestHeaderEnum } from './http/request-headers';
export type { HttpRequest, HttpHeaderValue } from './http/request';
export type { HttpResponseHeader, NonStandardHttpResponseHeaders, StandardHttpResponseHeaders } from './http/response-headers';
export { HttpResponseHeaderEnum } from './http/response-headers';
export { HttpStatusCode } from './http/status-codes';
export { HttpVerb, HttpVerbEnum } from './http/verb';

export type {
	MutableSome,
	RequireSome,
	Nullable,
	PartialSome,
	Mutable,
	EitherField,
	Xor,
	Undefinable,
	RequireAtLeastOne,
	Class,
	OneOf,
	RequireOnlyOne,
	Conditional,
	DotKeyOf,
	MaybePromise,
	NoDefinedProperties,
	NoDefinedPropertiesFrom,
	Optional,
	Tuplize,
	Values,
	Voidable
} from './mapped';
export type { PromiseHolder, PublicPrivateKeys } from './utils';

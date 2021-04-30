/**
 * Standard http request fields.
 *
 * @see {@link https://en.wikipedia.org/wiki/List_of_HTTP_header_fields#Standard_request_fields}
 */
export type StandardHttpRequestHeaders =
	| 'a-im'
	| 'accept'
	| 'accept-charset'
	| 'accept-datetime'
	| 'accept-encoding'
	| 'accept-language'
	| 'access-control-request-method'
	| 'access-control-request-headers'
	| 'authorization'
	| 'cache-control'
	| 'connection'
	| 'content-encoding'
	| 'content-length'
	| 'content-md5'
	| 'content-type'
	| 'cookie'
	| 'date'
	| 'expect'
	| 'forwarded'
	| 'from'
	| 'host'
	| 'http2-settings'
	| 'if-match'
	| 'if-modified-since'
	| 'if-none-match'
	| 'if-range'
	| 'if-unmodified-since'
	| 'max-forwards'
	| 'origin'
	| 'pragma'
	| 'prefer'
	| 'proxy-authorization'
	| 'range'
	| 'referer'
	| 'te'
	| 'trailer'
	| 'transfer-encoding'
	| 'user-agent'
	| 'upgrade'
	| 'via'
	| 'warning';

/**
 * Non standard http request headers.
 *
 * @see {@link https://en.wikipedia.org/wiki/List_of_HTTP_header_fields#common_non-standard_request_fields}
 */
export type NonStandardHttpRequestHeaders =
	| 'upgrade-insecure-requests'
	| 'x-requested-with'
	| 'dnt'
	| 'x-forwarded-for'
	| 'x-forwarded-host'
	| 'x-forwarded-proto'
	| 'front-end-https'
	| 'x-http-method-override'
	| 'x-att-deviceid'
	| 'x-wap-profile'
	| 'proxy-connection'
	| 'x-uidh'
	| 'x-csrf-token'
	| 'x-request-id'
	| 'x-correlation-id'
	| 'save-data';

/**
 * HTTP request headers.
 *
 * @see {@link https://en.wikipedia.org/wiki/List_of_HTTP_header_fields#Request_fields}
 */
export type HttpRequestHeader = StandardHttpRequestHeaders | NonStandardHttpRequestHeaders;

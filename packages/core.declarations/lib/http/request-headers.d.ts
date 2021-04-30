/**
 * Standard http request fields.
 *
 * @see {@link https://en.wikipedia.org/wiki/List_of_HTTP_header_fields#Standard_request_fields}
 */
export type StandardHttpRequestHeaders =
	| 'A-IM'
	| 'Accept'
	| 'Accept-Charset'
	| 'Accept-Datetime'
	| 'Accept-Encoding'
	| 'Accept-Language'
	| 'Access-Control-Request-Method'
	| 'Access-Control-Request-Headers'
	| 'Authorization'
	| 'Cache-Control'
	| 'Connection'
	| 'Content-Encoding'
	| 'Content-Length'
	| 'Content-MD5'
	| 'Content-Type'
	| 'Cookie'
	| 'Date'
	| 'Expect'
	| 'Forwarded'
	| 'From'
	| 'Host'
	| 'HTTP2-Settings'
	| 'If-Match'
	| 'If-Modified-Since'
	| 'If-None-Match'
	| 'If-Range'
	| 'If-Unmodified-Since'
	| 'Max-Forwards'
	| 'Origin'
	| 'Pragma'
	| 'Prefer'
	| 'Proxy-Authorization'
	| 'Range'
	| 'Referer'
	| 'TE'
	| 'Trailer'
	| 'Transfer-Encoding'
	| 'User-Agent'
	| 'Upgrade'
	| 'Via'
	| 'Warning';

/**
 * Non standard http request headers.
 *
 * @see {@link https://en.wikipedia.org/wiki/List_of_HTTP_header_fields#Common_non-standard_request_fields}
 */
export type NonStandardHttpRequestHeaders =
	| 'Upgrade-Insecure-Requests'
	| 'X-Requested-With'
	| 'DNT'
	| 'X-Forwarded-For'
	| 'X-Forwarded-Host'
	| 'X-Forwarded-Proto'
	| 'Front-End-Https'
	| 'X-Http-Method-Override'
	| 'X-ATT-DeviceId'
	| 'X-Wap-Profile'
	| 'Proxy-Connection'
	| 'X-UIDH'
	| 'X-Csrf-Token'
	| 'X-Request-ID'
	| 'X-Correlation-ID'
	| 'Save-Data';

/**
 * HTTP request headers.
 *
 * @see {@link https://en.wikipedia.org/wiki/List_of_HTTP_header_fields#Request_fields}
 */
export type HttpRequestHeader = StandardHttpRequestHeaders | NonStandardHttpRequestHeaders;

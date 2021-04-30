/**
 * Standard http response headers.
 *
 * @see {@link https://en.wikipedia.org/wiki/List_of_HTTP_header_fields#Standard_response_fields}
 */
export type StandardHttpResponseHeaders =
	| 'Accept-CH'
	| 'Access-Control-Allow-Origin'
	| 'Access-Control-Allow-Credentials'
	| 'Access-Control-Expose-Headers'
	| 'Access-Control-Max-Age'
	| 'Access-Control-Allow-Methods'
	| 'Access-Control-Allow-Headers'
	| 'Accept-Patch'
	| 'Accept-Ranges'
	| 'Age'
	| 'Allow'
	| 'Alt-Svc'
	| 'Cache-Control'
	| 'Connection'
	| 'Content-Disposition'
	| 'Content-Encoding'
	| 'Content-Language'
	| 'Content-Length'
	| 'Content-Location'
	| 'Content-MD5'
	| 'Content-Range'
	| 'Content-Type'
	| 'Date'
	| 'Delta-Base'
	| 'ETag'
	| 'Expires'
	| 'IM'
	| 'Last-Modified'
	| 'Link'
	| 'Location'
	| 'P3P'
	| 'Pragma'
	| 'Preference-Applied'
	| 'Proxy-Authenticate'
	| 'Public-Key-Pins'
	| 'Retry-After'
	| 'Server'
	| 'Set-Cookie'
	| 'Strict-Transport-Security'
	| 'Trailer'
	| 'Transfer-Encoding'
	| 'Tk'
	| 'Upgrade'
	| 'Vary'
	| 'Via'
	| 'Warning'
	| 'WWW-Authenticate'
	| 'X-Frame-Options';

/**
 * Non standard http response headers.
 *
 * @see {@link https://en.wikipedia.org/wiki/List_of_HTTP_header_fields#Common_non-standard_response_fields}
 */
export type NonStandardHttpResponseHeaders =
	| 'Content-Security-Policy'
	| 'X-Content-Security-Policy'
	| 'X-WebKit-CSP'
	| 'Refresh'
	| 'Status'
	| 'Timing-Allow-Origin'
	| 'X-Content-Duration'
	| 'X-Content-Type-Options'
	| 'X-Powered-By'
	| 'X-Request-ID'
	| 'X-Correlation-ID'
	| 'X-UA-Compatible'
	| 'X-XSS-Protection';

/**
 * HTTP response headers.
 *
 * @see {@link https://en.wikipedia.org/wiki/List_of_HTTP_header_fields#Response_fields}
 */
declare type HttpResponseHeader = StandardHttpResponseHeaders | NonStandardHttpResponseHeaders;

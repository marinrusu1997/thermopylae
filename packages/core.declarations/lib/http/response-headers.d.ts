/**
 * Standard http response headers.
 *
 * @see {@link https://en.wikipedia.org/wiki/List_of_HTTP_header_fields#Standard_response_fields}
 */
export type StandardHttpResponseHeaders =
	| 'accept-ch'
	| 'access-control-allow-origin'
	| 'access-control-allow-credentials'
	| 'access-control-expose-headers'
	| 'access-control-max-age'
	| 'access-control-allow-methods'
	| 'access-control-allow-headers'
	| 'accept-patch'
	| 'accept-ranges'
	| 'age'
	| 'allow'
	| 'alt-svc'
	| 'cache-control'
	| 'connection'
	| 'content-disposition'
	| 'content-encoding'
	| 'content-language'
	| 'content-length'
	| 'content-location'
	| 'content-md5'
	| 'content-range'
	| 'content-type'
	| 'date'
	| 'delta-base'
	| 'etag'
	| 'expires'
	| 'im'
	| 'last-modified'
	| 'link'
	| 'location'
	| 'p3p'
	| 'pragma'
	| 'preference-applied'
	| 'proxy-authenticate'
	| 'public-key-pins'
	| 'retry-after'
	| 'server'
	| 'set-cookie'
	| 'strict-transport-security'
	| 'trailer'
	| 'transfer-encoding'
	| 'tk'
	| 'upgrade'
	| 'vary'
	| 'via'
	| 'warning'
	| 'www-authenticate'
	| 'x-frame-options';

/**
 * Non standard http response headers.
 *
 * @see {@link https://en.wikipedia.org/wiki/List_of_HTTP_header_fields#Common_non-standard_response_fields}
 */
export type NonStandardHttpResponseHeaders =
	| 'content-security-policy'
	| 'x-content-security-policy'
	| 'x-webkit-csp'
	| 'refresh'
	| 'status'
	| 'timing-allow-origin'
	| 'x-content-duration'
	| 'x-content-type-options'
	| 'x-powered-by'
	| 'x-request-id'
	| 'x-correlation-id'
	| 'x-ua-compatible'
	| 'x-xss-protection';

/**
 * HTTP response headers.
 *
 * @see {@link https://en.wikipedia.org/wiki/List_of_HTTP_header_fields#Response_fields}
 */
declare type HttpResponseHeader = StandardHttpResponseHeaders | NonStandardHttpResponseHeaders;

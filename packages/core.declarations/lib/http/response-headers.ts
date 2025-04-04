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
export type HttpResponseHeader = StandardHttpResponseHeaders | NonStandardHttpResponseHeaders;

/**
 * HTTP response headers enum.
 *
 * @see {@link https://en.wikipedia.org/wiki/List_of_HTTP_header_fields#Response_fields}
 */
export enum HttpResponseHeaderEnum {
	/** Requests [HTTP Client Hints](https://en.wikipedia.org/wiki/HTTP_Client_Hints). */
	ACCEPT_CH = 'accept-ch',
	/**
	 * Specifying which web sites can participate in [cross-origin resource
	 * sharing](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing).
	 */
	ACCESS_CONTROL_ALLOW_ORIGIN = 'access-control-allow-origin',
	/**
	 * Specifying which web sites can participate in [cross-origin resource
	 * sharing](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing).
	 */
	ACCESS_CONTROL_ALLOW_CREDENTIALS = 'access-control-allow-credentials',
	/**
	 * Specifying which web sites can participate in [cross-origin resource
	 * sharing](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing).
	 */
	ACCESS_CONTROL_EXPOSE_HEADERS = 'access-control-expose-headers',
	/**
	 * Specifying which web sites can participate in [cross-origin resource
	 * sharing](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing).
	 */
	ACCESS_CONTROL_MAX_AGE = 'access-control-max-age',
	/**
	 * Specifying which web sites can participate in [cross-origin resource
	 * sharing](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing).
	 */
	ACCESS_CONTROL_ALLOW_METHODS = 'access-control-allow-methods',
	/**
	 * Specifying which web sites can participate in [cross-origin resource
	 * sharing](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing).
	 */
	ACCESS_CONTROL_ALLOW_HEADER = 'access-control-allow-headers',
	/** Specifies which patch document formats this server supports. */
	ACCEPT_PATCH = 'accept-patch',
	/**
	 * What partial content range types this server supports via [byte
	 * serving](https://en.wikipedia.org/wiki/Byte_serving).
	 */
	ACCEPT_RANGES = 'accept-ranges',
	/**
	 * The age the object has been in a [proxy cache](https://en.wikipedia.org/wiki/Web_cache) in
	 * seconds.
	 */
	AGE = 'age',
	/** Valid methods for a specified resource. To be used for a _405 Method not allowed_. */
	ALLOW = 'allow',
	/**
	 * A server uses "Alt-Svc" header (meaning Alternative Services) to indicate that its resources
	 * can also be accessed at a different network location (host or port) or using a different
	 * protocol. <br/> When using HTTP/2, servers should instead send an ALTSVC frame.
	 */
	ALT_SVC = 'alt-svc',
	/**
	 * Tells all caching mechanisms from server to client whether they may cache this object. <br/>
	 * It is measured in seconds.
	 */
	CACHE_CONTROL = 'cache-control',
	/**
	 * Control options for the current connection and list of hop-by-hop response fields. <br/> Must
	 * not be used with HTTP/2.
	 */
	CONNECTION = 'connection',
	/**
	 * An opportunity to raise a "File Download" dialogue box for a known MIME type with binary
	 * format or suggest a filename for dynamic content. <br/> Quotes are necessary with special
	 * characters.
	 */
	CONTENT_DISPOSITION = 'content-disposition',
	/**
	 * The type of encoding used on the data. See [HTTP
	 * compression](https://en.wikipedia.org/wiki/HTTP_compression).
	 */
	CONTENT_ENCODING = 'content-encoding',
	/** The natural language or languages of the intended audience for the enclosed content. */
	CONTENT_LANGUAGE = 'content-language',
	/** The length of the response body in octets (8-bit bytes). */
	CONTENT_LENGTH = 'content-length',
	/** An alternate location for the returned data. */
	CONTENT_LOCATION = 'content-location',
	/** A Base64-encoded binary MD5 sum of the content of the response. */
	CONTENT_MD5 = 'content-md5',
	/** Where in a full body message this partial message belongs. */
	CONTENT_RANGE = 'content-range',
	/** The [MIME type](https://en.wikipedia.org/wiki/Media_type) of this content. */
	CONTENT_TYPE = 'content-type',
	/** The date and time that the message was sent (in "HTTP-date" format as defined by RFC 7231) */
	DATE = 'date',
	/** Specifies the delta-encoding entity tag of the response. */
	DELTA_BASE = 'delta-base',
	/**
	 * An identifier for a specific version of a resource, often a [message
	 * digest](https://en.wikipedia.org/wiki/Cryptographic_hash_function)
	 */
	ETAG = 'etag',
	/**
	 * Gives the date/time after which the response is considered stale (in "HTTP-date" format as
	 * defined by RFC 7231)
	 */
	EXPIRES = 'expires',
	/** Instance-manipulations applied to the response. */
	IM = 'im',
	/**
	 * The last modified date for the requested object (in "HTTP-date" format as defined by RFC
	 * 7231)
	 */
	LAST_MODIFIED = 'last-modified',
	/**
	 * Used to express a typed relationship with another resource, where the relation type is
	 * defined by RFC 5988.
	 */
	LINK = 'link',
	/** Used in redirection, or when a new resource has been created. */
	LOCATION = 'location',
	/**
	 * This field is supposed to set P3P policy, in the form of P3P:CP="your_compact_policy".
	 * However, P3P did not take off, most browsers have never fully implemented it, a lot of
	 * websites set this field with fake policy text, that was enough to fool browsers the existence
	 * of P3P policy and grant permissions for third party cookies.
	 */
	P3P = 'p3p',
	/**
	 * Implementation-specific fields that may have various effects anywhere along the
	 * request-response chain.
	 */
	PRAGMA = 'pragma',
	/**
	 * Indicates which Prefer tokens were honored by the server and applied to the processing of the
	 * request.
	 */
	PREFERENCE_APPLIED = 'preference-applied',
	/** Request authentication to access the proxy. */
	PROXY_AUTHENTICATE = 'proxy-authenticate',
	/**
	 * ```
	 * HTTP Public Key Pinning, announces hash of website's authentic TLS certificate
	 * ```
	 */
	PUBLIC_KEY_PINS = 'public-key-pins',
	/**
	 * If an entity is temporarily unavailable, this instructs the client to try again later. Value
	 * could be a specified period of time (in seconds) or a HTTP-date.
	 */
	RETRY_AFTER = 'retry-after',
	/** A name for the server. */
	SERVER = 'server',
	/** An HTTP cookie. */
	SET_COOKIE = 'set-cookie',
	/**
	 * A HSTS Policy informing the HTTP client how long to cache the HTTPS only policy and whether
	 * this applies to subdomains.
	 */
	STRICT_TRANSPORT_SECURITY = 'strict-transport-security',
	/**
	 * The Trailer general field value indicates that the given set of header fields is present in
	 * the trailer of a message encoded with chunked transfer coding.
	 */
	TRAILER = 'trailer',
	/**
	 * The form of encoding used to safely transfer the entity to the user. Currently defined
	 * methods are: chunked, compress, deflate, gzip, identity. Must not be used with HTTP/2.
	 */
	TRANSFER_ENCODING = 'transfer-encoding',
	/**
	 * Tracking Status header, value suggested to be sent in response to a DNT(do-not-track),
	 * possible values:
	 *
	 * - "!" — under construction.
	 * - "?" — dynamic.
	 * - "G" — gateway to multiple parties.
	 * - "N" — not tracking.
	 * - "T" — tracking.
	 * - "C" — tracking with consent.
	 * - "P" — tracking only if consented.
	 * - "D" — disregarding DNT.
	 * - "U" — updated.
	 */
	TK = 'tk',
	/** Ask the client to upgrade to another protocol. Must not be used in HTTP/2. */
	UPGRADE = 'upgrade',
	/**
	 * Tells downstream proxies how to match future request headers to decide whether the cached
	 * response can be used rather than requesting a fresh one from the origin server.
	 */
	VARY = 'vary',
	/** Informs the client of proxies through which the response was sent. */
	VIA = 'via',
	/** A general warning about possible problems with the entity body. */
	WARNING = 'warning',
	/** Indicates the authentication scheme that should be used to access the requested entity. */
	WWW_AUTHENTICATE = 'www-authenticate',
	/**
	 * Clickjacking protection:
	 *
	 * - Deny - no rendering within a frame.
	 * - Sameorigin - no rendering if origin mismatch.
	 * - Allow-from - allow from specified location.
	 * - Allowall - non-standard, allow from any location.
	 */
	X_FRAME_OPTIONS = 'x-frame-options'
}

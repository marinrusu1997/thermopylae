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

/**
 * HTTP request headers enum.
 *
 * @see {@link https://en.wikipedia.org/wiki/List_of_HTTP_header_fields#Request_fields}
 */
export enum HttpRequestHeaderEnum {
	/** Acceptable instance-manipulations for the request. */
	A_IM = 'a-im',
	/**
	 * [Media type(s)](https://en.wikipedia.org/wiki/Media_type) that is/are acceptable for the
	 * response. See [Content negotiation](https://en.wikipedia.org/wiki/Content_negotiation).
	 */
	ACCEPT = 'accept',
	/** Character sets that are acceptable. */
	ACCEPT_CHARSET = 'accept-charset',
	/** Acceptable version in time. */
	ACCEPT_DATETIME = 'accept-datetime',
	/**
	 * List of acceptable encodings. See [HTTP
	 * compression](https://en.wikipedia.org/wiki/HTTP_compression).
	 */
	ACCEPT_ENCODING = 'accept-encoding',
	/**
	 * List of acceptable human languages for response. See [Content
	 * negotiation](https://en.wikipedia.org/wiki/Content_negotiation).
	 */
	ACCEPT_LANGUAGE = 'accept-language',
	/**
	 * Initiates a request for [cross-origin resource
	 * sharing](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing) with
	 * [Origin](https://en.wikipedia.org/wiki/List_of_HTTP_header_fields#origin-request-header).
	 */
	ACCESS_CONTROL_REQUEST_METHOD = 'access-control-request-method',
	/**
	 * Initiates a request for [cross-origin resource
	 * sharing](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing) with
	 * [Origin](https://en.wikipedia.org/wiki/List_of_HTTP_header_fields#origin-request-header).
	 */
	ACCESS_CONTROL_REQUEST_HEADERS = 'access-control-request-headers',
	/**
	 * Authentication credentials for [HTTP
	 * authentication](https://en.wikipedia.org/wiki/Basic_access_authentication).
	 */
	AUTHORIZATION = 'authorization',
	/**
	 * Used to specify directives that must be obeyed by all [caching
	 * mechanisms](https://en.wikipedia.org/wiki/Web_cache#Cache-control) along the request-response
	 * chain.
	 */
	CACHE_CONTROL = 'cache-control',
	/**
	 * Control options for the current connection and list of hop-by-hop request fields. Must not be
	 * used with HTTP/2.
	 */
	CONNECTION = 'connection',
	/**
	 * The type of encoding used on the data. See [HTTP
	 * compression](https://en.wikipedia.org/wiki/HTTP_compression).
	 */
	CONTENT_ENCODING = 'content-encoding',
	/**
	 * The length of the request body in [octets](https://en.wikipedia.org/wiki/Octet_(computing))
	 * (8-bit bytes).
	 */
	CONTENT_LENGTH = 'content-length',
	/**
	 * A [Base64](https://en.wikipedia.org/wiki/Base64)-encoded binary
	 * [MD5](https://en.wikipedia.org/wiki/MD5) sum of the content of the request body.
	 */
	CONTENT_MD5 = 'content-md5',
	/**
	 * The [Media type](https://en.wikipedia.org/wiki/Media_type) of the body of the request (used
	 * with POST and PUT requests).
	 */
	CONTENT_TYPE = 'content-type',
	/**
	 * ```
	 * An [HTTP cookie](https://en.wikipedia.org/wiki/HTTP_cookie) previously sent by the server
	 * with [Set-Cookie](https://en.wikipedia.org/wiki/List_of_HTTP_header_fields#innerlink_set-cookie).
	 * ```
	 */
	COOKIE = 'cookie',
	/**
	 * The date and time at which the message was originated (in "HTTP-date" format as defined by
	 * [RFC 7231 Date/Time Formats](http://tools.ietf.org/html/rfc7231#section-7.1.1.1)).
	 */
	DATE = 'date',
	/**
	 * ```
	 * Indicates that particular server behaviors are required by the client.
	 * ```
	 */
	EXPECT = 'expect',
	/** Disclose original information of a client connecting to a web server through an HTTP proxy. */
	FORWARDED = 'forwarded',
	/** The email address of the user making the request. */
	FROM = 'from',
	/**
	 * The domain name of the server (for [virtual
	 * hosting](https://en.wikipedia.org/wiki/Virtual_hosting)), and the [TCP
	 * port](https://en.wikipedia.org/wiki/List_of_TCP_and_UDP_port_numbers) number on which the
	 * server is listening. <br/> The
	 * [port](https://en.wikipedia.org/wiki/Port_(computer_networking)) number may be omitted if the
	 * port is the standard port for the service requested. <br/> Mandatory since HTTP/1.1. If the
	 * request is generated directly in HTTP/2, it should not be used.
	 */
	HOST = 'host',
	/**
	 * A request that upgrades from HTTP/1.1 to HTTP/2 MUST include exactly one _HTTP2-Setting_
	 * header field. The _HTTP2-Settings_ header field is a connection-specific header field that
	 * includes parameters that govern the HTTP/2 connection, provided in anticipation of the server
	 * accepting the request to upgrade.
	 */
	HTTP2_SETTING = 'http2-settings',
	/**
	 * Only perform the action if the client supplied entity matches the same entity on the server.
	 * This is mainly for methods like PUT to only update a resource if it has not been modified
	 * since the user last updated it.
	 */
	IF_MATCH = 'if-match',
	/** Allows a _304 Not Modified_ to be returned if content is unchanged. */
	IF_MODIFIED_SINCE = 'if-modified-since',
	/**
	 * Allows a _304 Not Modified_ to be returned if content is unchanged, see [HTTP
	 * ETag](https://en.wikipedia.org/wiki/HTTP_ETag_.
	 */
	IF_NONE_MATCH = 'if-none-match',
	/**
	 * If the entity is unchanged, send me the part(s) that I am missing; otherwise, send me the
	 * entire new entity.
	 */
	IF_RANGE = 'if-range',
	/** Only send the response if the entity has not been modified since a specific time. */
	IF_UNMODIFIED_SINCE = 'if-unmodified-since',
	/** Limit the number of times the message can be forwarded through proxies or gateways. */
	MAX_FORWARDS = 'max-forwards',
	/**
	 * Initiates a request for [cross-origin resource
	 * sharing](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing) (asks server for
	 * [Access-Control-*](https://en.wikipedia.org/wiki/List_of_HTTP_header_fields#access-control-response-headers)
	 * response fields).
	 */
	ORIGIN = 'origin',
	/**
	 * Implementation-specific fields that may have various effects anywhere along the
	 * request-response chain.
	 */
	PRAGMA = 'pragma',
	/**
	 * ```
	 * Allows client to request that certain behaviors be employed by a server while processing a request.
	 * ```
	 */
	PREFER = 'prefer',
	/** Authorization credentials for connecting to a proxy. */
	PROXY_AUTHORIZATION = 'proxy-authorization',
	/**
	 * Request only part of an entity. Bytes are numbered from 0. See [Byte
	 * serving](https://en.wikipedia.org/wiki/Byte_serving).
	 */
	RANGE = 'range',
	/**
	 * This is the address of the previous web page from which a link to the currently requested
	 * page was followed. (The word "referrer" has been misspelled in the RFC as well as in most
	 * implementations to the point that it has become standard usage and is considered correct
	 * terminology). See [Referer](https://en.wikipedia.org/wiki/HTTP_referer).
	 */
	REFERER = 'referer',
	/**
	 * The transfer encodings the user agent is willing to accept: the same values as for the
	 * response header field _Transfer-Encoding_ can be used, plus the "trailers" value (related to
	 * the "[chunked](https://en.wikipedia.org/wiki/Chunked_transfer_encoding)" transfer method) to
	 * notify the server it expects to receive additional fields in the trailer after the last,
	 * zero-sized, chunk. <br/> Only **trailers** is supported in HTTP/2.
	 */
	TE = 'te',
	/**
	 * The Trailer general field value indicates that the given set of header fields is present in
	 * the trailer of a message encoded with [chunked transfer
	 * coding](https://en.wikipedia.org/wiki/Chunked_transfer_encoding).
	 */
	TRAILER = 'trailer',
	/**
	 * The form of encoding used to safely transfer the entity to the user. [Currently defined
	 * methods](https://www.iana.org/assignments/http-parameters/http-parameters.xhtml) are:
	 * [chunked](https://en.wikipedia.org/wiki/Chunked_transfer_encoding), compress, deflate, gzip,
	 * identity. <br/> Must not be used with HTTP/2.
	 */
	TRANSFER_ENCODING = 'transfer-encoding',
	/** The [user agent](https://en.wikipedia.org/wiki/User_agent_string) string of the user agent. */
	USER_AGENT = 'user-agent',
	/** Ask the server to upgrade to another protocol. <br/> Must not be used in HTTP/2. */
	UPGRADE = 'upgrade',
	/**
	 * ```
	 * Informs the server of proxies through which the request was sent.
	 * ```
	 */
	VIA = 'via',
	/** A general warning about possible problems with the entity body. */
	WARNING = 'warning',

	/**
	 * Tells a server which (presumably in the middle of a HTTP -> HTTPS migration) hosts mixed
	 * content that the client would prefer redirection to HTTPS and can handle
	 * Content-Security-Policy: upgrade-insecure-requests/ Must not be used with HTTP/2.
	 */
	UPGRADE_INSECURE_REQUESTS = 'upgrade-insecure-requests',

	/**
	 * Mainly used to identify Ajax requests (most JavaScript frameworks send this field with value
	 * of XMLHttpRequest); also identifies Android apps using WebView.
	 */
	X_REQUESTED_WITH = 'x-requested-with',

	/**
	 * Requests a web application to disable their tracking of a user. This is Mozilla's version of
	 * the X-Do-Not-Track header field (since Firefox 4.0 Beta 11). Safari and IE9 also have support
	 * for this field.[23] On March 7, 2011, a draft proposal was submitted to IETF. The W3C
	 * Tracking Protection Working Group is producing a specification.
	 */
	DNT = 'dnt',

	/**
	 * A de facto standard for identifying the originating IP address of a client connecting to a
	 * web server through an HTTP proxy or load balancer. Superseded by Forwarded header.
	 */
	X_FORWARDED_FOR = 'x-forwarded-for',

	/**
	 * A de facto standard for identifying the original host requested by the client in the Host
	 * HTTP request header, since the host name and/or port of the reverse proxy (load balancer) may
	 * differ from the origin server handling the request. Superseded by Forwarded header.
	 */
	X_FORWARDED_HOST = 'x-forwarded-host',

	/**
	 * A de facto standard for identifying the originating protocol of an HTTP request, since a
	 * reverse proxy (or a load balancer) may communicate with a web server using HTTP even if the
	 * request to the reverse proxy is HTTPS. An alternative form of the header (X-ProxyUser-Ip) is
	 * used by Google clients talking to Google servers. Superseded by Forwarded header.
	 */
	X_FORWARDED_PROTO = 'x-forwarded-proto',

	/** Non-standard header field used by Microsoft applications and load-balancers. */
	FRONT_END_HTTPS = 'front-end-https',

	/**
	 * Requests a web application to override the method specified in the request (typically POST)
	 * with the method given in the header field (typically PUT or DELETE). This can be used when a
	 * user agent or firewall prevents PUT or DELETE methods from being sent directly (note that
	 * this is either a bug in the software component, which ought to be fixed, or an intentional
	 * configuration, in which case bypassing it may be the wrong thing to do).
	 */
	X_HTTP_METHOD_OVERRIDE = 'x-http-method-override',

	/**
	 * Allows easier parsing of the MakeModel/Firmware that is usually found in the User-Agent
	 * String of AT&T Devices.
	 */
	X_ATT_DEVICE_ID = 'x-att-deviceid',

	/**
	 * Links to an XML file on the Internet with a full description and details about the device
	 * currently connecting. In the example to the right is an XML file for an AT&T Samsung Galaxy
	 * S2.
	 */
	X_WAP_PROFILE = 'x-wap-profile',

	/**
	 * Implemented as a misunderstanding of the HTTP specifications. Common because of mistakes in
	 * implementations of early HTTP versions. Has exactly the same functionality as standard
	 * Connection field. Must not be used with HTTP/2.
	 */
	PROXY_CONNECTION = 'proxy-connection',

	/**
	 * Server-side deep packet insertion of a unique ID identifying customers of Verizon Wireless;
	 * also known as "perma-cookie" or "supercookie"
	 */
	X_UIDH = 'x-uidh',

	/**
	 * Used to prevent cross-site request forgery. Alternative header names are: X-CSRFToken[38] and
	 * X-XSRF-TOKEN.
	 */
	X_CSRF_TOKEN = 'x-csrf-token',

	/** Correlates HTTP requests between a client and server. */
	X_REQUEST_ID = 'x-request-id',

	/** Correlates HTTP requests between a client and server. */
	X_CORRELATION_ID = 'x-correlation-id',

	/**
	 * The Save-Data client hint request header available in Chrome, Opera, and Yandex browsers lets
	 * developers deliver lighter, faster applications to users who opt-in to data saving mode in
	 * their browser.
	 */
	SAVE_DATA = 'save-data'
}

/**
 * @typedef {string|Buffer|Stream}  Content
 */

/**
 * @typedef EmailPriority
 * @property {string}   HIGH "high"
 * @property {string}   NORMAL "normal"
 * @property {string}   LOW "low"
 */

/**
 * @typedef AuthType
 * @property {string}   LOGIN "login"
 * @property {string}   OAUTH2 "oauth2"
 */

/**
 * @interface SMTPEnvelope
 *
 * @property {string}           from  the first address gets used as MAIL FROM address in SMTP
 * @property {Array<string>}    to    addresses from this value get added to RCPT TO list
 * @property {Array<string>}    cc    addresses from this value get added to RCPT TO list
 * @property {Array<string>}    bcc    addresses from this value get added to RCPT TO list
 */

/**
 * @typedef {{
 *     messageId: string,
 *     envelope: SMTPEnvelope,
 *     accepted: Array<string>,
 *     rejected: Array<string>,
 *     pending: Array<string>
 * }} SendMailRecipe
 */

/**
 * @interface TransportOptions
 *
 * @property {number}   port    is the port to connect to (defaults to 587 if is secure is false or 465 if true)
 * @property {string}   host    is the hostname or IP address to connect to (defaults to ‘localhost’)
 * @property {object}   auth    defines authentication data
 * @property {AuthType} auth.type   authentication type
 * @property {string}   auth.user
 * @property {string}   [auth.pass]
 * @property {string}   [auth.clientId]  is the registered client id of the application
 * @property {string}   [auth.clientSecret]  is the registered client secret of the application
 * @property {string}   [auth.refreshToken] is an optional refresh token. If it is provided then Nodemailer tries to generate a new access token if existing one expires or fails
 * @property {string}   [auth.accessToken]  is the access token for the user. Required only if refreshToken is not available and there is no token refresh callback specified
 * @property {number}   [auth.expires]   is an optional expiration time for the current accessToken
 * @property {string}   [auth.accessUrl]     is an optional HTTP endpoint for requesting new access tokens. This value defaults to Gmail
 * @property {string}   authMethod  defines preferred authentication method, defaults to ‘PLAIN’
 *
 * @property {boolean}  [secure]   if true the connection will use TLS when connecting to server. If false (the default) then TLS is used if server supports the STARTTLS extension. In most cases set this value to true if you are connecting to port 465. For port 587 or 25 keep it false
 * @property {object}   [tls]   defines additional node.js TLSSocket options to be passed to the socket constructor, eg. {rejectUnauthorized: true}.
 * @property {boolean}  [ignoreTLS] if this is true and secure is false then TLS is not used even if the server supports STARTTLS extension
 * @property {boolean}  [requireTLS] if this is true and secure is false then Nodemailer tries to use STARTTLS even if the server does not advertise support for it. If the connection can not be encrypted then message is not sent
 *
 * @property {object|boolean}   [logger]   optional bunyan compatible logger instance. If set to true then logs to console. If value is not set or is false then nothing is logged
 * @property {boolean}  [debug] if set to true, then logs SMTP traffic, otherwise logs only transaction events
 *
 * @property {boolean}  [disableFileAccess] if true, then does not allow to use files as content. Use it when you want to use JSON data from untrusted source as the email. If an attachment or message node tries to fetch something from a file the sending returns an error
 * @property {boolean}  [disableUrlAccess]  if true, then does not allow to use Urls as content
 *
 * @property {boolean}  [pool]  set to true to use pooled connections (defaults to false) instead of creating a new connection for every email
 * @property {number}   [maxConnections]    is the count of maximum simultaneous connections to make against the SMTP server (defaults to 5)
 *
 * @property {object}   [dkim]  is an object with DKIM options
 * @property {string}   [dkim.domainName]   is the domain name to use in the signature
 * @property {string}   [dkim.privateKey]   is the private key for the selector in PEM format
 * @property {string}   [dkim.cacheDir]     optional location for cached messages. If not set then caching is not used.
 * @property {number}   [dkim.cacheTreshold]   optional size in bytes, if message is larger than this treshold it gets cached to disk (assuming cacheDir is set and writable). Defaults to 131072 (128 kB).
 * @property {string}   [dkim.hashAlgo]
 * @property {string}   [dkim.headerFieldNames] an optional colon separated list of header keys to sign (eg. message-id:date:from:to...')
 * @property {string}   [dkim.skipFields]   optional colon separated list of header keys not to sign. This is useful if you want to sign all the relevant keys but your provider changes some values, ie Message-ID and Date. In this case you should use 'message-id:date' to prevent signing these values.
 */

/**
 * @interface AddressObject
 *
 * @property {string}   name    Name of the sender/recipient
 * @property {string}   address Address of the sender/recipient
 */

/**
 * @interface EmailAttachment
 *
 * @property {string}   filename                Filename to be reported as the name of the attached file
 * @property {Content}  content                 Contents for the attachment
 * @property {string}   [path]                  Path to the file if you want to stream the file instead of including it (better for larger attachments)
 * @property {string}   [href]                  An URL to the file
 * @property {object}   [httpHeaders]           Optional HTTP headers to pass on with the href request
 * @property {string}   [contentType]           Optional content type for the attachment, if not set will be derived from the filename property
 * @property {string}   [contentDisposition]    Optional content disposition type for the attachment, defaults to ‘attachment’
 * @property {string}   [cid]                   Optional content id for using inline images in HTML message source
 * @property {string}   [encoding]              If set and content is string, then encodes the content to a Buffer using the specified encoding
 * @property {object}   [headers]               Custom headers for the attachment node. Same usage as with message headers
 * @property {string}   [raw]                   Is an optional special value that overrides entire contents of current mime node including mime headers. Useful if you want to prepare node contents yourself
 *
 */

/**
 * @interface EmailMessage
 *
 * @property {string|AddressObject}             from
 * @property {Array<string|AddressObject>}      to
 * @property {Array<string|AddressObject>}      [cc]
 * @property {Array<string|AddressObject>}      [bcc]
 * @property {string}                           subject
 * @property {Content}                          [text]
 * @property {Content}                          [html]
 * @property {Array<EmailAttachment>}           [attachments]
 *
 * @property {string|AddressObject}             [sender]        An email address that will appear on the Sender: field
 * @property {string|AddressObject}             [replyTo]       An email address that will appear on the Reply-To: field
 * @property {string|AddressObject}             [inReplyTo]     The Message-ID this message is replying to
 * @property {Array<string>}                    [references]    Message-ID list
 * @property {SMTPEnvelope}                     [envelope]      Optional SMTP envelope, if auto generated envelope is not suitable
 *
 * @property {boolean}                          [attachDataUrls]    If true then convert data: images in the HTML content of this message to embedded attachments
 * @property {string}                           [watchHtml]         Apple Watch specific HTML version of the message
 * @property {string}                           [amp]               AMP4EMAIL specific HTML version of the message
 *
 * @property {string}                           [encoding]      identifies encoding for text/html strings (defaults to ‘utf-8’, other values are ‘hex’ and ‘base64’)
 *
 * @property {EmailPriority}                    [priority]      Sets message importance headers
 *
 * @property {boolean}  [disableFileAccess]     if true, then does not allow to use files as content. Use it when you want to use JSON data from untrusted source as the email. If an attachment or message node tries to fetch something from a file the sending returns an error. If this field is also set in the transport options, then the value in mail data is ignored
 * @property {boolean}  [disableUrlAccess]       if true, then does not allow to use Urls as content. If this field is also set in the transport options, then the value in mail data is ignored
 */

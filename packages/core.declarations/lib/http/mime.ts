/**
 * Mime types that can be used for *Content-Type* HTTP header.
 */
export const enum MimeType {
	/**
	 * AAC audio
	 */
	AAC = 'audio/aac',

	/**
	 * [AbiWord](https://en.wikipedia.org/wiki/AbiWord) document
	 */
	ABI_WORD = 'application/x-abiword',

	/**
	 * Archive document (multiple files embedded)
	 */
	ARC = 'application/x-freearc',

	/**
	 * AVI: Audio Video Interleave
	 */
	AVI = 'video/x-msvideo',

	/**
	 * Amazon Kindle eBook format
	 */
	AZW = 'application/vnd.amazon.ebook',

	/**
	 * Any kind of binary data
	 */
	BIN = 'application/octet-stream',

	/**
	 * Windows OS/2 Bitmap Graphics
	 */
	BMP = 'image/bmp',

	/**
	 * BZip archive
	 */
	BZIP = 'application/x-bzip',

	/**
	 * BZip2 archive
	 */
	BZIP2 = 'application/x-bzip2',

	/**
	 * C-Shell script
	 */
	CSH = 'application/x-csh',

	/**
	 * Cascading Style Sheets (CSS)
	 */
	CSS = 'text/css',

	/**
	 * Comma-separated values (CSV)
	 */
	CSV = 'text/csv',

	/**
	 * Microsoft Word
	 */
	DOC = 'application/msword',

	/**
	 * Microsoft Word (OpenXML)
	 */
	DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

	/**
	 * MS Embedded OpenType fonts
	 */
	EOT = 'application/vnd.ms-fontobject',

	/**
	 * Electronic publication (EPUB)
	 */
	EPUB = 'application/epub+zip',

	/**
	 * GZip Compressed Archive
	 */
	GZIP = 'application/gzip',

	/**
	 * Graphics Interchange Format (GIF)
	 */
	GIF = 'image/gif',

	/**
	 * HyperText Markup Language (HTML)
	 */
	HTML = 'text/html',

	/**
	 * Icon format
	 */
	ICO = 'image/vnd.microsoft.icon',

	/**
	 * iCalendar format
	 */
	ICALENDAR = 'text/calendar',

	/**
	 * Java Archive (JAR)
	 */
	JAR = 'application/java-archive',

	/**
	 * JPEG images
	 */
	JPEG = 'image/jpeg',

	/**
	 * JavaScript, per the following specifications:
	 *  - [whatwg scripting languages](https://html.spec.whatwg.org/multipage/#scriptingLanguages)
	 *  - [whatwg dependencies willful violation](https://html.spec.whatwg.org/multipage/#dependencies:willful-violation)
	 *  - [datatracker](https://datatracker.ietf.org/doc/draft-ietf-dispatch-javascript-mjs/)
	 */
	JAVA_SCRIPT = 'text/javascript',

	/**
	 * JSON format
	 */
	JSON = 'application/json',

	/**
	 * JSON-LD format
	 */
	JSON_LD = 'application/ld+json',

	/**
	 * Musical Instrument Digital Interface (MIDI)
	 */
	MIDI = 'audio/midi',

	/**
	 * JavaScript module
	 */
	JAVA_SCRIPT_MODULE = 'text/javascript',

	/**
	 * MP3 audio
	 */
	MP3 = 'audio/mpeg',

	/**
	 * CD audio
	 */
	CD_AUDIO = 'application/x-cdf',

	/**
	 * MP4 audio
	 */
	MP4 = 'video/mp4',

	/**
	 * MPEG Video
	 */
	MPEG = 'video/mpeg',

	/**
	 * Apple Installer Package
	 */
	APPLE_INSTALLER_PACKAGE = 'application/vnd.apple.installer+xml',

	/**
	 * OpenDocument presentation document
	 */
	OPEN_DOCUMENT_PRESENTATION = 'application/vnd.oasis.opendocument.presentation',

	/**
	 * OpenDocument spreadsheet document
	 */
	OPEN_DOCUMENT_SPREADSHEET = 'application/vnd.oasis.opendocument.spreadsheet',

	/**
	 * OpenDocument text document
	 */
	OPEN_DOCUMENT_TEXT = 'application/vnd.oasis.opendocument.text',

	/**
	 * OGG
	 */
	OGG = 'application/ogg',

	/**
	 * OGG audio
	 */
	OGG_AUDIO = 'audio/ogg',

	/**
	 * OGG video
	 */
	OGG_VIDEO = 'video/ogg',

	/**
	 * Opus audio
	 */
	OPUS_AUDIO = 'audio/opus',

	/**
	 * OpenType font
	 */
	OPEN_TYPE_FONT = 'font/otf',

	/**
	 * Portable Network Graphics
	 */
	PNG = 'image/png',

	/**
	 * Adobe [Portable Document Format](https://acrobat.adobe.com/us/en/acrobat/about-adobe-pdf.html) (PDF)
	 */
	PDF = 'application/pdf',

	/**
	 * Hypertext Preprocessor (Personal Home Page)
	 */
	PHP = 'application/x-httpd-php',

	/**
	 * Microsoft PowerPoint
	 */
	PPT = 'application/vnd.ms-powerpoint',

	/**
	 * Microsoft PowerPoint (OpenXML)
	 */
	PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

	/**
	 * RAR archive
	 */
	RAR = 'application/vnd.rar',

	/**
	 * Rich Text Format (RTF)
	 */
	RTF = 'application/rtf',

	/**
	 * Bourne shell script
	 */
	SHELL = 'application/x-sh',

	/**
	 * Scalable Vector Graphics (SVG)
	 */
	SVG = 'image/svg+xml',

	/**
	 * [Small web format](https://en.wikipedia.org/wiki/SWF) (SWF) or Adobe Flash document
	 */
	SWF = 'application/x-shockwave-flash',

	/**
	 * Tape Archive (TAR)
	 */
	TAR = 'application/x-tar',

	/**
	 * Tagged Image File Format (TIFF)
	 */
	TIFF = 'image/tiff',

	/**
	 * MPEG transport stream
	 */
	MPEG_TRANSPORT_STREAM = 'video/mp2t',

	/**
	 * TrueType Font
	 */
	TTF = 'font/ttf',

	/**
	 * Text, (generally ASCII or ISO 8859-n)
	 */
	TEXT = 'text/plain',

	/**
	 * Microsoft Visio
	 */
	VSD = 'application/vnd.visio',

	/**
	 * Waveform Audio Format
	 */
	WAV = 'audio/wav',

	/**
	 * WEBM audio
	 */
	WEBM_AUDIO = 'audio/webm',

	/**
	 * WEBM video
	 */
	WEBM_VIDEO = 'video/webm',

	/**
	 * WEBP image
	 */
	WEBP_IMAGE = 'image/webp',

	/**
	 * Web Open Font Format (WOFF)
	 */
	WOFF = 'font/woff',

	/**
	 * Web Open Font Format (WOFF)
	 */
	WOFF2 = 'font/woff2',

	/**
	 * XHTML
	 */
	XHTML = 'application/xhtml+xml',

	/**
	 * Microsoft Excel
	 */
	XLS = 'application/vnd.ms-excel',

	/**
	 * Microsoft Excel (OpenXML)
	 */
	XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

	/**
	 * XMLS
	 */
	XML = 'application/xml',

	/**
	 * XUL
	 */
	XUL = 'application/vnd.mozilla.xul+xml',

	/**
	 * ZIP archive
	 */
	ZIP = 'application/zip',

	/**
	 * [3GPP](https://en.wikipedia.org/wiki/3GP_and_3G2) audio container
	 */
	'3GPP_AUDIO' = 'audio/3gpp',

	/**
	 * [3GPP](https://en.wikipedia.org/wiki/3GP_and_3G2) video container
	 */
	'3GPP_VIDEO' = 'video/3gpp',

	/**
	 * [3GPP2](https://en.wikipedia.org/wiki/3GP_and_3G2) audio container
	 */
	'3GPP2_AUDIO' = 'audio/3gpp2',

	/**
	 * [3GPP2](https://en.wikipedia.org/wiki/3GP_and_3G2) video container
	 */
	'3GPP2_VIDEO' = 'video/3gpp2',

	/**
	 * [7-zip](https://en.wikipedia.org/wiki/7-Zip) archive
	 */
	'7ZIP' = 'application/x-7z-compressed'
}

/**
 * Mime extensions.
 */
export const enum MimeExt {
	/**
	 * AAC audio
	 */
	AAC = '.aac',

	/**
	 * [AbiWord](https://en.wikipedia.org/wiki/AbiWord) document
	 */
	ABI_WORD = '.abw',

	/**
	 * Archive document (multiple files embedded)
	 */
	ARC = '.arc',

	/**
	 * AVI: Audio Video Interleave
	 */
	AVI = '.avi',

	/**
	 * Amazon Kindle eBook format
	 */
	AZW = '.azw',

	/**
	 * Any kind of binary data
	 */
	BIN = '.bin',

	/**
	 * Windows OS/2 Bitmap Graphics
	 */
	BMP = '.bmp',

	/**
	 * BZip archive
	 */
	BZIP = '.bz',

	/**
	 * BZip2 archive
	 */
	BZIP2 = '.bz2',

	/**
	 * C-Shell script
	 */
	CSH = '.csh',

	/**
	 * Cascading Style Sheets (CSS)
	 */
	CSS = '.css',

	/**
	 * Comma-separated values (CSV)
	 */
	CSV = '.csv',

	/**
	 * Microsoft Word
	 */
	DOC = '.doc',

	/**
	 * Microsoft Word (OpenXML)
	 */
	DOCX = '.docx',

	/**
	 * MS Embedded OpenType fonts
	 */
	EOT = '.eot',

	/**
	 * Electronic publication (EPUB)
	 */
	EPUB = '.epub',

	/**
	 * GZip Compressed Archive
	 */
	GZIP = '.gz',

	/**
	 * Graphics Interchange Format (GIF)
	 */
	GIF = '.gif',

	/**
	 * HyperText Markup Language (HTML)
	 */
	HTML = '.html',

	/**
	 * Icon format
	 */
	ICO = '.ico',

	/**
	 * iCalendar format
	 */
	ICALENDAR = '.ics',

	/**
	 * Java Archive (JAR)
	 */
	JAR = '.jar',

	/**
	 * JPEG images
	 */
	JPEG = '.jpeg',

	/**
	 * JavaScript, per the following specifications:
	 *  - [whatwg scripting languages](https://html.spec.whatwg.org/multipage/#scriptingLanguages)
	 *  - [whatwg dependencies willful violation](https://html.spec.whatwg.org/multipage/#dependencies:willful-violation)
	 *  - [datatracker](https://datatracker.ietf.org/doc/draft-ietf-dispatch-javascript-mjs/)
	 */
	JAVA_SCRIPT = '.js',

	/**
	 * JSON format
	 */
	JSON = '.json',

	/**
	 * JSON-LD format
	 */
	JSON_LD = '.jsonld',

	/**
	 * Musical Instrument Digital Interface (MIDI)
	 */
	MIDI = '.midi',

	/**
	 * JavaScript module
	 */
	JAVA_SCRIPT_MODULE = '.mjs',

	/**
	 * MP3 audio
	 */
	MP3 = '.mp3',

	/**
	 * CD audio
	 */
	CD_AUDIO = '.cda',

	/**
	 * MP4 audio
	 */
	MP4 = '.mp4',

	/**
	 * MPEG Video
	 */
	MPEG = '.mpeg',

	/**
	 * Apple Installer Package
	 */
	APPLE_INSTALLER_PACKAGE = '.mpkg',

	/**
	 * OpenDocument presentation document
	 */
	OPEN_DOCUMENT_PRESENTATION = '.odp',

	/**
	 * OpenDocument spreadsheet document
	 */
	OPEN_DOCUMENT_SPREADSHEET = '.ods',

	/**
	 * OpenDocument text document
	 */
	OPEN_DOCUMENT_TEXT = '.odt',

	/**
	 * OGG
	 */
	OGG = '.ogx',

	/**
	 * OGG audio
	 */
	OGG_AUDIO = '.oga',

	/**
	 * OGG video
	 */
	OGG_VIDEO = '.ogv',

	/**
	 * Opus audio
	 */
	OPUS_AUDIO = '.opus',

	/**
	 * OpenType font
	 */
	OPEN_TYPE_FONT = '.otf',

	/**
	 * Portable Network Graphics
	 */
	PNG = '.png',

	/**
	 * Adobe [Portable Document Format](https://acrobat.adobe.com/us/en/acrobat/about-adobe-pdf.html) (PDF)
	 */
	PDF = '.pdf',

	/**
	 * Hypertext Preprocessor (Personal Home Page)
	 */
	PHP = '.php',

	/**
	 * Microsoft PowerPoint
	 */
	PPT = '.ppt',

	/**
	 * Microsoft PowerPoint (OpenXML)
	 */
	PPTX = '.pptx',

	/**
	 * RAR archive
	 */
	RAR = '.rar',

	/**
	 * Rich Text Format (RTF)
	 */
	RTF = '.rtf',

	/**
	 * Bourne shell script
	 */
	SHELL = '.sh',

	/**
	 * Scalable Vector Graphics (SVG)
	 */
	SVG = '.svg',

	/**
	 * [Small web format](https://en.wikipedia.org/wiki/SWF) (SWF) or Adobe Flash document
	 */
	SWF = '.swf',

	/**
	 * Tape Archive (TAR)
	 */
	TAR = '.tar',

	/**
	 * Tagged Image File Format (TIFF)
	 */
	TIFF = '.tiff',

	/**
	 * MPEG transport stream
	 */
	MPEG_TRANSPORT_STREAM = '.ts',

	/**
	 * TrueType Font
	 */
	TTF = '.ttf',

	/**
	 * Text, (generally ASCII or ISO 8859-n)
	 */
	TEXT = '.txt',

	/**
	 * Microsoft Visio
	 */
	VSD = '.vsd',

	/**
	 * Waveform Audio Format
	 */
	WAV = '.wav',

	/**
	 * WEBM audio
	 */
	WEBM_AUDIO = '.weba',

	/**
	 * WEBM video
	 */
	WEBM_VIDEO = '.webm',

	/**
	 * WEBP image
	 */
	WEBP_IMAGE = '.webp',

	/**
	 * Web Open Font Format (WOFF)
	 */
	WOFF = '.woff',

	/**
	 * Web Open Font Format (WOFF)
	 */
	WOFF2 = '.woff2',

	/**
	 * XHTML
	 */
	XHTML = '.xhtml',

	/**
	 * Microsoft Excel
	 */
	XLS = '.xls',

	/**
	 * Microsoft Excel (OpenXML)
	 */
	XLSX = '.xlsx',

	/**
	 * XMLS
	 */
	XML = '.xml',

	/**
	 * XUL
	 */
	XUL = '.xul',

	/**
	 * ZIP archive
	 */
	ZIP = '.zip',

	/**
	 * [3GPP](https://en.wikipedia.org/wiki/3GP_and_3G2) audio container
	 */
	'3GPP_AUDIO' = '.3gp',

	/**
	 * [3GPP](https://en.wikipedia.org/wiki/3GP_and_3G2) video container
	 */
	'3GPP_VIDEO' = '.3gp',

	/**
	 * [3GPP2](https://en.wikipedia.org/wiki/3GP_and_3G2) audio container
	 */
	'3GPP2_AUDIO' = '.3g2',

	/**
	 * [3GPP2](https://en.wikipedia.org/wiki/3GP_and_3G2) video container
	 */
	'3GPP2_VIDEO' = '.3g2',

	/**
	 * [7-zip](https://en.wikipedia.org/wiki/7-Zip) archive
	 */
	'7ZIP' = '.7z'
}

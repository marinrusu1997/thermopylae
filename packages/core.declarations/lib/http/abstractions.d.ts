import { HttpDevice } from './device';
import { HttpRequestHeader } from './request-headers';
import { HttpStatusCode } from './status-codes';
import { MimeType } from './mime';
import { HttpResponseHeader } from './response-headers';

/**
 * Values taken by HTTP header.
 */
type HttpHeaderValue = string | Array<string>;

/**
 * HTTP Request abstraction.
 *
 * @template Body	Type of the body.
 */
declare interface HttpRequest<Body> {
	/**
	 * Return the remote address or the upstream addr (when behind web proxy).
	 */
	readonly ip: string;

	/**
	 * Request body.
	 */
	readonly body: Body;

	/**
	 * Device from where request has been made.
	 */
	readonly device: HttpDevice | null;

	/**
	 * Return request header.
	 *
	 * @param name	Name of the header.
	 */
	header(name: HttpRequestHeader | string): HttpHeaderValue | undefined;

	/**
	 * Return path param.
	 *
	 * @param name	Name of the param.
	 */
	param(name: string): string | undefined;

	/**
	 * Return query param.
	 *
	 * @param name	Name of the param.
	 */
	query(name: string): string | undefined;

	/**
	 * Return cookie value.
	 *
	 * @param name	Name of the cookie.
	 */
	cookie(name: string): string | undefined;
}

/**
 * HTTP Response abstraction.
 *
 * @template Payload	Response payload.
 */
declare interface HttpResponse<Payload> {
	/**
	 * Whether the request was sent.
	 */
	readonly sent: boolean;

	/**
	 * Set status code.
	 *
	 * @param statusCode	Status code.
	 */
	status(statusCode: HttpStatusCode): this;

	/**
	 * Set *Content-Type* response header with type. <br/>
	 * It's recommended to be set with the help of [mime-types](https://www.npmjs.com/package/mime-types) npm package.
	 *
	 * @param mimeType
	 */
	type(mimeType: MimeType | string): this;

	/**
	 * Set header *field* to *value*.
	 *
	 * @param field		Name of the header.
	 * @param value		Value of the header.
	 */
	header(field: HttpResponseHeader | string, value: HttpHeaderValue): this;

	/**
	 * Send a response.
	 *
	 * @param payload	Response payload.
	 */
	send(payload?: Payload): void;
}

export { HttpRequest, HttpResponse, HttpHeaderValue };

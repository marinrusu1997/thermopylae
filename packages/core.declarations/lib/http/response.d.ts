import type { HttpStatusCode } from './status-codes';
import type { MimeType } from './mime';
import type { HttpResponseHeader } from './response-headers';
import type { HttpHeaderValue } from './request';

/**
 * HTTP Response abstraction.
 *
 * @template Payload	Response payload.
 */
export interface HttpResponse<Payload = unknown> {
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

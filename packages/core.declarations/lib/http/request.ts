import type { HttpDevice } from './device.js';
import type { HTTPRequestLocation } from './location.js';
import type { HttpRequestHeader } from './request-headers.js';

/** Values taken by HTTP header. */
export type HttpHeaderValue = string | Array<string>;

/**
 * HTTP Request abstraction.
 *
 * @template Body Type of the body.
 */
export interface HttpRequest<Body = unknown> {
	/** The remote address or the upstream address (when behind web proxy). */
	readonly ip: string;

	/** Request body. */
	readonly body: Body;

	/** Device from where request has been made. */
	readonly device?: HttpDevice | null;

	/** Location from where request has been made. */
	readonly location?: HTTPRequestLocation | null;

	/**
	 * Return request header.
	 *
	 * @param name Name of the header.
	 */
	header(name: HttpRequestHeader | string): HttpHeaderValue | undefined;

	/**
	 * Return path param.
	 *
	 * @param name Name of the param.
	 */
	param(name: string): string | undefined;

	/**
	 * Return query param.
	 *
	 * @param name Name of the param.
	 */
	query(name: string): string | undefined;

	/**
	 * Return cookie value.
	 *
	 * @param name Name of the cookie.
	 */
	cookie(name: string): string | undefined;
}

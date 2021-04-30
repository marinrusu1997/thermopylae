import type { HttpHeaderValue, HttpResponse, HttpResponseHeader, HttpStatusCode, MimeType, ObjMap } from '@thermopylae/core.declarations';
import type { Response } from 'express';

/**
 * Adapter for express response instance.
 *
 * @template Payload	Type of the response payload..
 */
class ExpressResponseAdapter<Payload = ObjMap> implements HttpResponse<Payload> {
	private readonly res: Response;

	public constructor(res: Response) {
		this.res = res;
	}

	/**
	 * Get raw express response instance.
	 */
	public get raw(): Response {
		return this.res;
	}

	/**
	 * @inheritDoc
	 */
	public get sent(): boolean {
		return this.res.headersSent;
	}

	/**
	 * @inheritDoc
	 */
	public status(statusCode: HttpStatusCode): this {
		this.res.status(statusCode);
		return this;
	}

	/**
	 * @inheritDoc
	 */
	public header(field: HttpResponseHeader | string, value: HttpHeaderValue): this {
		this.res.append(field, value);
		return this;
	}

	/**
	 * @inheritDoc
	 */
	public type(mimeType: MimeType | string): this {
		this.res.type(mimeType);
		return this;
	}

	/**
	 * @inheritDoc
	 */
	public send(payload?: Payload): void {
		this.res.send(payload);
	}
}

export { ExpressResponseAdapter };

import type { HttpHeaderValue, HttpResponse, HttpResponseHeader, HttpStatusCode, MimeType, ObjMap } from '@thermopylae/core.declarations';
import type { FastifyReply } from 'fastify';

/**
 * Adapter for fastify reply instance.
 *
 * @template Payload Type of the response payload.
 */
class FastifyResponseAdapter<Payload = ObjMap> implements HttpResponse<Payload> {
	private readonly res: FastifyReply;

	public constructor(res: FastifyReply) {
		this.res = res;
	}

	/** Get raw fastify response instance. */
	public get raw(): FastifyReply {
		return this.res;
	}

	/** @inheritDoc */
	public get sent(): boolean {
		return this.res.sent;
	}

	/** @inheritDoc */
	public status(statusCode: HttpStatusCode): this {
		this.res.status(statusCode);
		return this;
	}

	/** @inheritDoc */
	public header(field: HttpResponseHeader | string, value: HttpHeaderValue): this {
		this.res.header(field, value);
		return this;
	}

	/** @inheritDoc */
	public type(mimeType: MimeType | string): this {
		this.res.type(mimeType);
		return this;
	}

	/** @inheritDoc */
	public send(payload?: Payload): void {
		this.res.send(payload);
	}
}

export { FastifyResponseAdapter };

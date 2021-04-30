// eslint-disable-next-line max-classes-per-file
import type { HttpDevice, HttpHeaderValue, HttpRequest, HttpRequestHeader, HttpDeviceDetector, ObjMap } from '@thermopylae/core.declarations';
import type { FastifyRequest } from 'fastify';
import type { DeviceDetectorResult } from 'device-detector-js';
import DeviceDetectorJs from 'device-detector-js';

/**
 * @private
 */
class FastifyDeviceDetector implements HttpDeviceDetector<FastifyRequest> {
	private readonly detector: DeviceDetectorJs;

	public constructor() {
		this.detector = new DeviceDetectorJs();
	}

	public detect(req: FastifyRequest): DeviceDetectorResult | null {
		const userAgent = req.headers['user-agent'];
		if (typeof userAgent !== 'string') {
			return null;
		}
		return this.detector.parse(userAgent);
	}
}

/**
 * Adapter for fastify request instance.
 *
 * @template Body	Type of the body.
 */
class FastifyRequestAdapter<Body = ObjMap> implements HttpRequest<Body> {
	/**
	 * Device detector. <br/>
	 * You can assign you own **HttpDeviceDetector** implementation. <br/>
	 * Defaults to **FastifyDeviceDetector** which detects device based on *User-Agent* header.
	 */
	public static deviceDetector: HttpDeviceDetector<FastifyRequest> = new FastifyDeviceDetector();

	private readonly req: FastifyRequest;

	public constructor(req: FastifyRequest) {
		this.req = req;
	}

	/**
	 * Get raw fastify request instance.
	 */
	public get raw(): FastifyRequest {
		return this.req;
	}

	/**
	 * @inheritDoc
	 */
	public get ip(): string {
		return this.req.ips ? this.req.ips[1] : this.req.ip;
	}

	/**
	 * @inheritDoc
	 */
	public get body(): Body {
		return this.req.body as Body;
	}

	/**
	 * @inheritDoc
	 */
	public get device(): HttpDevice | null {
		return FastifyRequestAdapter.deviceDetector.detect(this.req);
	}

	/**
	 * @inheritDoc
	 */
	public header(name: HttpRequestHeader | string): HttpHeaderValue | undefined {
		return this.req.headers[name];
	}

	/**
	 * @inheritDoc
	 */
	public cookie(name: string): string | undefined {
		// @ts-ignore
		return this.req.cookies[name];
	}

	/**
	 * @inheritDoc
	 */
	public param(name: string): string | undefined {
		return (this.req.params as ObjMap)[name];
	}

	/**
	 * @inheritDoc
	 */
	public query(name: string): string | undefined {
		return (this.req.query as ObjMap)[name];
	}
}

export { FastifyRequestAdapter };

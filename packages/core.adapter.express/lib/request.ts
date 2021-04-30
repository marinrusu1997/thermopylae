// eslint-disable-next-line max-classes-per-file
import type { HttpRequest, DeviceDetector, HttpDevice, HttpRequestHeader, ObjMap, HttpHeaderValue } from '@thermopylae/core.declarations';
import type { Request } from 'express';
import type { DeviceDetectorResult } from 'device-detector-js';
import DeviceDetectorJs from 'device-detector-js';

/**
 * @private
 */
class ExpressDeviceDetector implements DeviceDetector<Request> {
	private readonly detector: DeviceDetectorJs;

	public constructor() {
		this.detector = new DeviceDetectorJs();
	}

	public detect(req: Request): DeviceDetectorResult | null {
		const userAgent = req.header('User-Agent');
		if (typeof userAgent !== 'string') {
			return null;
		}
		return this.detector.parse(userAgent);
	}
}

/**
 * Adapter for express request instance.
 *
 * @template Body	Type of the body.
 */
class ExpressRequestAdapter<Body = ObjMap> implements HttpRequest<Body> {
	/**
	 * Device detector. <br/>
	 * You can assign you own **DeviceDetector** implementation. <br/>
	 * Defaults to **ExpressDeviceDetector** which detects device based on *User-Agent* header.
	 */
	public static deviceDetector: DeviceDetector<Request> = new ExpressDeviceDetector();

	private readonly req: Request;

	public constructor(req: Request) {
		this.req = req;
	}

	/**
	 * Get raw express request instance.
	 */
	public get raw(): Request {
		return this.req;
	}

	/**
	 * @inheritDoc
	 */
	public get ip(): string {
		return this.req.ip;
	}

	/**
	 * @inheritDoc
	 */
	public get body(): Body {
		return this.req.body;
	}

	/**
	 * @inheritDoc
	 */
	public get device(): HttpDevice | null {
		return ExpressRequestAdapter.deviceDetector.detect(this.req);
	}

	/**
	 * @inheritDoc
	 */
	public header(name: HttpRequestHeader | string): HttpHeaderValue | undefined {
		return this.req.header(name);
	}

	/**
	 * @inheritDoc
	 */
	public cookie(name: string): string | undefined {
		return this.req.cookies[name];
	}

	/**
	 * @inheritDoc
	 */
	public param(name: string): string | undefined {
		return this.req.params[name];
	}

	/**
	 * @inheritDoc
	 */
	public query(name: string): string | undefined {
		return this.req.query[name] as string;
	}
}

export { ExpressRequestAdapter };

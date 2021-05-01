// eslint-disable-next-line max-classes-per-file
import type {
	HttpRequest,
	HttpDeviceDetector,
	HttpDevice,
	HttpRequestHeader,
	ObjMap,
	HttpHeaderValue,
	HTTPRequestLocation
} from '@thermopylae/core.declarations';
import type { Request } from 'express';
import type { DeviceDetectorResult } from 'device-detector-js';
import DeviceDetectorJs from 'device-detector-js';

const DEVICE_SYM = Symbol('HTTP_DEVICE_SYM');
const LOCATION_SYM = Symbol('HTTP_LOCATION_SYM');

/**
 * Express request instance managed by {@link ExpressRequestAdapter}.
 */
interface AdaptedExpressRequest extends Request {
	/**
	 * Property under which *ExpressDeviceDetector* stores detected device. <br/>
	 * Notice that if you pass an express request object to {@link ExpressRequestAdapter}
	 * which already has this property with according device, *ExpressDeviceDetector* won't compute this property again.
	 */
	[DEVICE_SYM]?: DeviceDetectorResult;
	/**
	 * Property under which location of the request is stored. <br/>
	 * *Important!* Clients of the {@link ExpressRequestAdapter} have to set this property accordingly
	 * on express request object before passing it to adapter, as he won't compute it.
	 */
	[LOCATION_SYM]?: HTTPRequestLocation;
}

/**
 * @private
 */
class ExpressDeviceDetector implements HttpDeviceDetector<AdaptedExpressRequest> {
	private readonly detector: DeviceDetectorJs;

	public constructor() {
		this.detector = new DeviceDetectorJs();
	}

	public detect(req: AdaptedExpressRequest): DeviceDetectorResult | undefined {
		if (req[DEVICE_SYM] == null) {
			const userAgent = req.header('user-agent');
			if (typeof userAgent !== 'string') {
				return undefined;
			}
			req[DEVICE_SYM] = this.detector.parse(userAgent);
		}
		return req[DEVICE_SYM];
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
	 * You can assign you own **HttpDeviceDetector** implementation. <br/>
	 * Defaults to **ExpressDeviceDetector** which detects device based on *User-Agent* header.
	 */
	public static deviceDetector: HttpDeviceDetector<AdaptedExpressRequest> = new ExpressDeviceDetector();

	private readonly req: AdaptedExpressRequest;

	public constructor(req: AdaptedExpressRequest) {
		this.req = req;
	}

	/**
	 * Get raw express request instance.
	 */
	public get raw(): AdaptedExpressRequest {
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
	public get device(): HttpDevice | undefined {
		return ExpressRequestAdapter.deviceDetector.detect(this.req);
	}

	/**
	 * @inheritDoc
	 */
	public get location(): HTTPRequestLocation | undefined {
		return this.req[LOCATION_SYM];
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

export { ExpressRequestAdapter, DEVICE_SYM, LOCATION_SYM, AdaptedExpressRequest };

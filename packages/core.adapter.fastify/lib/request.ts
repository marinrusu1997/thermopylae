// eslint-disable-next-line max-classes-per-file
import type {
	HttpDevice,
	HttpHeaderValue,
	HttpRequest,
	HttpRequestHeader,
	HttpDeviceDetector,
	HTTPRequestLocation,
	ObjMap
} from '@thermopylae/core.declarations';
import type { FastifyRequest } from 'fastify';
import type { DeviceDetectorResult } from 'device-detector-js';
import DeviceDetectorJs from 'device-detector-js';

const DEVICE_SYM = Symbol('HTTP_DEVICE_SYM');
const LOCATION_SYM = Symbol('HTTP_LOCATION_SYM');

/**
 * Fastify request instance managed by {@link FastifyRequestAdapter}.
 */
interface AdaptedFastifyRequest extends FastifyRequest {
	/**
	 * Property under which *FastifyDeviceDetector* stores detected device. <br/>
	 * Notice that if you pass a fastify request object to {@link FastifyRequestAdapter}
	 * which already has this property with according device, *FastifyDeviceDetector* won't compute this property again.
	 */
	[DEVICE_SYM]?: DeviceDetectorResult;
	/**
	 * Property under which location of the request is stored. <br/>
	 * *Important!* Clients of the {@link FastifyRequestAdapter} have to set this property accordingly
	 * on fastify request object before passing it to adapter, as he won't compute it.
	 */
	[LOCATION_SYM]?: HTTPRequestLocation;
}

/**
 * @private
 */
class FastifyDeviceDetector implements HttpDeviceDetector<AdaptedFastifyRequest> {
	private readonly detector: DeviceDetectorJs;

	public constructor() {
		this.detector = new DeviceDetectorJs();
	}

	public detect(req: AdaptedFastifyRequest): DeviceDetectorResult | undefined {
		if (req[DEVICE_SYM] == null) {
			const userAgent = req.headers['user-agent'];
			if (typeof userAgent !== 'string') {
				return undefined;
			}
			req[DEVICE_SYM] = this.detector.parse(userAgent);
		}
		return req[DEVICE_SYM];
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
	public static deviceDetector: HttpDeviceDetector<AdaptedFastifyRequest> = new FastifyDeviceDetector();

	private readonly req: AdaptedFastifyRequest;

	public constructor(req: AdaptedFastifyRequest) {
		this.req = req;
	}

	/**
	 * Get raw fastify request instance.
	 */
	public get raw(): AdaptedFastifyRequest {
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
	public get device(): HttpDevice | undefined {
		return FastifyRequestAdapter.deviceDetector.detect(this.req);
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

export { FastifyRequestAdapter, AdaptedFastifyRequest, LOCATION_SYM, DEVICE_SYM };

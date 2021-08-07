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
// eslint-disable-next-line import/no-unresolved
import type { RouteGenericInterface } from 'fastify/types/route';
// eslint-disable-next-line import/no-unresolved
import type { RawRequestDefaultExpression, RawServerBase, RawServerDefault } from 'fastify/types/utils';
import type { DeviceDetectorResult } from 'device-detector-js';
import DeviceDetectorJs from 'device-detector-js';

const DEVICE_SYM = Symbol('HTTP_DEVICE_SYM');
const LOCATION_SYM = Symbol('HTTP_LOCATION_SYM');

/**
 * Fastify request instance managed by {@link FastifyRequestAdapter}.
 */
interface AdaptedFastifyRequest<
	RouteGeneric extends RouteGenericInterface = RouteGenericInterface,
	RawServer extends RawServerBase = RawServerDefault,
	RawRequest extends RawRequestDefaultExpression<RawServer> = RawRequestDefaultExpression<RawServer>
> extends FastifyRequest<RouteGeneric, RawServer, RawRequest> {
	/**
	 * Property under which *FastifyDeviceDetector* stores detected device. <br/>
	 * Notice that if you pass a fastify request object to {@link FastifyRequestAdapter}
	 * which already has this property with according device, *FastifyDeviceDetector* won't compute this property again.
	 */
	[DEVICE_SYM]?: DeviceDetectorResult | null;
	/**
	 * Property under which location of the request is stored. <br/>
	 * *Important!* Clients of the {@link FastifyRequestAdapter} have to set this property accordingly
	 * on fastify request object before passing it to adapter, as he won't compute it.
	 */
	[LOCATION_SYM]?: HTTPRequestLocation | null;
}

/**
 * Device detector which extracts device from *User-Agent* header by using
 * [device-detector-js](https://www.npmjs.com/package/device-detector-js) dependency. <br/>
 * Device is stored in the Fastify request object under {@link DEVICE_SYM} symbol.
 */
class FastifyDeviceDetector implements HttpDeviceDetector<AdaptedFastifyRequest> {
	private readonly detector: DeviceDetectorJs;

	public constructor() {
		this.detector = new DeviceDetectorJs();
	}

	public detect(req: AdaptedFastifyRequest): DeviceDetectorResult | undefined | null {
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
	 * Defaults to {@link FastifyDeviceDetector} which detects device based on *User-Agent* header.
	 */
	public static deviceDetector: HttpDeviceDetector<AdaptedFastifyRequest> = new FastifyDeviceDetector();

	// @fixme we will need another detector in the app.module which will take client type from
	// special header: X-Requested-By, and will set according client
	// we will employ decorator patern, to add this new functionality

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
		return this.req.ip;
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
	public get device(): HttpDevice | undefined | null {
		return FastifyRequestAdapter.deviceDetector.detect(this.req);
	}

	/**
	 * @inheritDoc
	 */
	public get location(): HTTPRequestLocation | undefined | null {
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

export { FastifyRequestAdapter, AdaptedFastifyRequest, FastifyDeviceDetector, LOCATION_SYM, DEVICE_SYM };

import { GeoIP, IpLocation } from '@marin/lib.geoip';
import Exception from '@marin/lib.error';

interface MethodBehaviour {
	expectingInput: (...args: any[]) => void;
	returns?: IpLocation;
	throws?: Error | Exception;
}

const enum GeoIpMethods {
	LOCATE = 'LOCATE'
}

class GeoIpMock extends GeoIP {
	private behaviours: Map<GeoIpMethods, MethodBehaviour> = new Map<GeoIpMethods, MethodBehaviour>();

	constructor() {
		super('api key does not matter');
	}

	async locate(ip: string): Promise<IpLocation> {
		const behaviour = this.getBehaviour(GeoIpMethods.LOCATE);
		behaviour.expectingInput(ip);
		if (behaviour.throws) {
			throw behaviour.throws;
		}
		return behaviour.returns as IpLocation;
	}

	setBehaviour(method: GeoIpMethods, behaviour: MethodBehaviour): void {
		this.behaviours.set(method, behaviour);
	}

	private getBehaviour(method: GeoIpMethods): MethodBehaviour {
		const behaviour = this.behaviours.get(method);
		if (!behaviour) {
			throw new Error(`Couldn't find behaviour for method ${method}`);
		}
		return behaviour;
	}
}

export { GeoIpMock, GeoIpMethods };

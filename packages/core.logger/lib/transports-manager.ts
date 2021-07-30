import * as TransportStream from 'winston-transport';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { AbstractTransportManager } from './typings';
import { createException, ErrorCodes } from './error';

/**
 * Handles all types of transports.
 *
 * @internal
 * */
class TransportsManager {
	private readonly transports: Array<AbstractTransportManager>;

	public constructor() {
		this.transports = [];
	}

	/**
	 * Registers transport managers, by adding them to list of known ones. <br>
	 * Transport managers has not to be registered before, as no mechanism for preventing duplicates exists.
	 *
	 * @param transportManagers Instances of transport managers.
	 */
	public register(transportManagers: Array<AbstractTransportManager>): void {
		this.transports.push(...transportManagers);
	}

	/**
	 * Given a module name, returns an array of transports. <br>
	 * Returned transports will contain combined transports from all managers on which this module was registered.
	 *
	 * @param module  Name of the module.
	 */
	public for(module: string): Array<TransportStream> {
		const transports = [];

		let transport;
		for (let i = 0; i < this.transports.length; i++) {
			if ((transport = this.transports[i].get(module)) != null) {
				transports.push(transport);
			}
		}

		if (!transports.length) {
			throw createException(ErrorCodes.NO_TRANSPORTS_FOR_MODULE, `No transports were configured for ${module}.`);
		}

		return transports;
	}
}

export { TransportsManager };

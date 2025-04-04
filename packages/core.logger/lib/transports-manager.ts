import type TransportStream from 'winston-transport';
import { ErrorCodes, createException } from './error.js';
import type { AbstractTransportManager } from './typings.js';

/**
 * Handles all types of transports.
 *
 * @internal
 */
class TransportsManager {
	private readonly transports: AbstractTransportManager[];

	public constructor() {
		this.transports = [];
	}

	/**
	 * Registers transport managers, by adding them to list of known ones. <br> Transport managers
	 * has not to be registered before, as no mechanism for preventing duplicates exists.
	 *
	 * @param transportManagers Instances of transport managers.
	 */
	public register(transportManagers: AbstractTransportManager[]): void {
		this.transports.push(...transportManagers);
	}

	/**
	 * Given a module name, returns an array of transports. <br> Returned transports will contain
	 * combined transports from all managers on which this module was registered.
	 *
	 * @param module Name of the module.
	 */
	public for(module: string): TransportStream[] {
		const transports = [];

		for (const transportManager of this.transports) {
			const transport = transportManager.get(module);
			if (transport != null) {
				transports.push(transport);
			}
		}

		if (transports.length === 0) {
			throw createException(ErrorCodes.NO_TRANSPORTS_FOR_MODULE, `No transports were configured for ${module}.`);
		}

		return transports;
	}
}

export { TransportsManager };

import { Nullable } from '@thermopylae/core.declarations';
import * as TransportStream from 'winston-transport';

/**
 * @internal
 */
declare interface AbstractTransportManager {
	/**
	 * Returns the transports configured for module.
	 * If no transports configured, null will be returned.
	 *
	 * @param   module     The name of the module.
	 */
	get: (module: string) => Nullable<TransportStream>;
}

export { AbstractTransportManager };

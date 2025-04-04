import type { Nullable } from '@thermopylae/core.declarations';
import type TransportStream from 'winston-transport';

/** @internal */
interface AbstractTransportManager {
	/**
	 * Returns the transports configured for module. If no transports configured, null will be
	 * returned.
	 *
	 * @param module The name of the module.
	 */
	get: (module: string) => Nullable<TransportStream>;
}

export type { AbstractTransportManager };

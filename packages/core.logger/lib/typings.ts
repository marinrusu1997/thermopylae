import * as TransportStream from 'winston-transport';
import type { Nullable } from '@thermopylae/core.declarations';

/** @internal */
declare interface AbstractTransportManager {
	/**
	 * Returns the transports configured for module. If no transports configured, null will be
	 * returned.
	 *
	 * @param module The name of the module.
	 */
	get: (module: string) => Nullable<TransportStream>;
}

export type { AbstractTransportManager };

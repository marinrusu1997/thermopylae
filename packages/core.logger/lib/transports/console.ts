import type { Nullable } from '@thermopylae/core.declarations';
import TransportStream from 'winston-transport';
import transports from 'winston/lib/winston/transports/index.js';
import type { ConsoleTransportOptions } from 'winston/lib/winston/transports/index.js';
import { ErrorCodes, createException } from '../error.js';
import type { AbstractTransportManager } from '../typings.js';

const { Console } = transports;

/**
 * Console transport is intended for development purposes, therefore no modules support is provided.
 * <br/> Uses builtin _Console_ transport from [winston](https://www.npmjs.com/package/winston) npm
 * package.
 */
class ConsoleLogsManager implements AbstractTransportManager {
	private transport: Nullable<TransportStream>;

	public constructor() {
		this.transport = null;
	}

	/**
	 * Creates console transport based on provided opts. When no opts provided, will use `info` log
	 * level.
	 *
	 * @param options Winston console transport options.
	 */
	public createTransport(options?: ConsoleTransportOptions): void {
		if (this.transport != null) {
			throw createException(ErrorCodes.TRANSPORT_EXISTS, 'Transport has been created already.');
		}
		this.transport = new Console(options);
	}

	/** @private */
	public get(): Nullable<TransportStream> {
		return this.transport;
	}
}

export { ConsoleLogsManager };
export type { ConsoleTransportOptions };

import { Nullable } from '@thermopylae/core.declarations';
import { Console, ConsoleTransportOptions } from 'winston/lib/winston/transports';
import TransportStream from 'winston-transport';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { AbstractTransportManager } from '../typings';

/**
 * Stores console config and transport. <br>
 * Console transport is intended for development purposes, therefore no modules support is provided.
 */
class ConsoleLogsManager implements AbstractTransportManager {
	private transport: Nullable<TransportStream>;

	public constructor() {
		this.transport = null;
	}

	/**
	 * Creates console transport based on provided opts.
	 * When no opts provided, will use `info` log level.
	 *
	 * @param  options  Winston console transport options.
	 */
	public createTransport(options?: ConsoleTransportOptions): void {
		this.transport = new Console(options);
	}

	/**
	 * @private
	 */
	public get(): Nullable<TransportStream> {
		return this.transport;
	}
}

export { ConsoleLogsManager, ConsoleTransportOptions };

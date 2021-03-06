// eslint-disable-next-line import/extensions
import transports from 'winston/lib/winston/transports';
import TransportStream from 'winston-transport';
import type { Nullable } from '@thermopylae/core.declarations';
import type { ConsoleTransportOptions } from 'winston/lib/winston/transports';
import type { AbstractTransportManager } from '../typings';
import { createException, ErrorCodes } from '../error';

const { Console } = transports;

/**
 * Console transport is intended for development purposes, therefore no modules support is provided. <br/>
 * Uses builtin *Console* transport from [winston](https://www.npmjs.com/package/winston) npm package.
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
		if (this.transport != null) {
			throw createException(ErrorCodes.TRANSPORT_EXISTS, 'Transport has been created already.');
		}
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

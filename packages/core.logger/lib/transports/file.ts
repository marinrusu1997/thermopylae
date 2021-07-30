import { Nullable } from '@thermopylae/core.declarations';
import * as TransportStream from 'winston-transport';
import DailyRotateFile, { DailyRotateFileTransportOptions } from 'winston-daily-rotate-file';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { AbstractTransportManager } from '../typings';
import { createException, ErrorCodes } from '../error';

/**
 * Class responsible for holding file transport object. <br/>
 * Uses [winston-daily-rotate-file](https://www.npmjs.com/package/winston-daily-rotate-file) npm package.
 */
class FileLogsManager implements AbstractTransportManager {
	private transport: Nullable<TransportStream>;

	public constructor() {
		this.transport = null;
	}

	/**
	 * Create file transport instance.
	 *
	 * @param   options   File transport options.
	 */
	public createTransport(options: DailyRotateFileTransportOptions): void {
		if (this.transport != null) {
			throw createException(ErrorCodes.TRANSPORT_EXISTS, 'Transport has been created already.');
		}

		options = { ...options };
		options.filename = `${options.filename}.${process.pid}`;
		this.transport = new DailyRotateFile(options);
	}

	/**
	 * Module name is silently discarded. All modules will log to same file
	 * with the level specified in file transport config. <br>
	 *
	 * @private
	 */
	public get(): Nullable<TransportStream> {
		return this.transport;
	}
}

export { FileLogsManager, DailyRotateFileTransportOptions };

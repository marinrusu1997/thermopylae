import * as TransportStream from 'winston-transport';
import type { Nullable } from '@thermopylae/core.declarations';
import DailyRotateFile from 'winston-daily-rotate-file';
import type { DailyRotateFileTransportOptions } from 'winston-daily-rotate-file';
import { ErrorCodes, createException } from '../error.js';
import type { AbstractTransportManager } from '../typings.js';

/**
 * Class responsible for holding file transport object. <br/> Uses
 * [winston-daily-rotate-file](https://www.npmjs.com/package/winston-daily-rotate-file) npm
 * package.
 */
class FileLogsManager implements AbstractTransportManager {
	private transport: Nullable<TransportStream>;

	public constructor() {
		this.transport = null;
	}

	/**
	 * Create file transport instance.
	 *
	 * @param options File transport options.
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
	 * Module name is silently discarded. All modules will log to same file with the level specified
	 * in file transport config. <br>
	 *
	 * @private
	 */
	public get(): Nullable<TransportStream> {
		return this.transport;
	}
}

export { FileLogsManager };
export type { DailyRotateFileTransportOptions };

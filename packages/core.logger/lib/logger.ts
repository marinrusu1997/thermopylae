import winston, { createLogger, Logger as WinstonLogger } from 'winston';
import { FormattingManager } from './formatting-manager';
import { ConsoleLogsManager } from './transports/console';
import { FileLogsManager } from './transports/file';
import { GrayLogsManager } from './transports/graylog';
import { TransportsManager } from './transports-manager';

/**
 * Class responsible for providing loggers to app modules. <br>
 */
class Logger {
	/**
	 * Formatting manager which configures format of the logging output.
	 */
	public readonly formatting: FormattingManager;

	/**
	 * Console transport manager which configures console transport.
	 */
	public readonly console: ConsoleLogsManager;

	/**
	 * File transport manager which configures file transport.
	 */
	public readonly file: FileLogsManager;

	/**
	 * Graylog2 transport manager which configures graylog2 transport.
	 */
	public readonly graylog2: GrayLogsManager;

	private readonly transports: TransportsManager;

	public constructor() {
		this.formatting = new FormattingManager();
		this.console = new ConsoleLogsManager();
		this.file = new FileLogsManager();
		this.graylog2 = new GrayLogsManager();
		this.transports = new TransportsManager();
		this.transports.register([this.console, this.file, this.graylog2]);
	}

	/**
	 * Method used by modules to retrieve their loggers. <br>
	 * Formatting and at least one of the transport managers needs to be configured before calling this method.
	 *
	 * @param module    Module for which logger will be created.
	 */
	public for(module: string): WinstonLogger {
		const transports = this.transports.for(module);
		const logger = createLogger({
			levels: winston.config.syslog.levels,
			format: this.formatting.formatterFor(module),
			transports,
			exceptionHandlers: transports,
			exitOnError: true
		});

		Object.freeze(logger);
		return logger;
	}
}

export { Logger, WinstonLogger };

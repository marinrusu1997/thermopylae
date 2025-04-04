import winston, { Logger as WinstonLogger, createLogger } from 'winston';
import { FormattingManager } from './formatting-manager.js';
import { TransportsManager } from './transports-manager.js';
import { ConsoleLogsManager } from './transports/console.js';
import { FileLogsManager } from './transports/file.js';
import { GrayLogsManager } from './transports/graylog.js';

/** Class responsible for providing loggers to app modules. <br> */
class LoggerManager {
	/** Formatting manager which configures format of the logging output. */
	public readonly formatting: FormattingManager;

	/** Console transport manager which configures console transport. */
	public readonly console: ConsoleLogsManager;

	/** File transport manager which configures file transport. */
	public readonly file: FileLogsManager;

	/** Graylog2 transport manager which configures graylog2 transport. */
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
	 * Method used by modules to retrieve their loggers. <br> Formatting and at least one of the
	 * transport managers needs to be configured before calling this method. <br/> After obtaining
	 * logger, module should not call again this method (i.e. it needs to save obtained logger).
	 *
	 * @param module Module for which logger will be created.
	 */
	public for(module: string): WinstonLogger {
		const transports = this.transports.for(module);
		const logger = createLogger({
			levels: winston.config.syslog.levels,
			format: this.formatting.formatterFor(module),
			transports
		});

		Object.freeze(logger);
		return logger;
	}
}

export { LoggerManager, WinstonLogger };

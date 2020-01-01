import winston, { createLogger } from 'winston';
import { TransportsManager } from '../transports/transports-manager';
import { ConsoleLogsManager } from '../transports/consolelogs-manager';
import { FileLogsManager } from '../transports/filelogs-manager';
import { GrayLogsManager } from '../transports/graylogs-manager';
import { FormattingManager } from '../formatting/formatting-manager';

const storage = new WeakMap();
/**
 * Private class data
 *
 * @param {object} _this This of the class
 * @return {{
 *     formatting: FormattingManager,
 *     console: ConsoleLogsManager,
 *     file: FileLogsManager,
 *     graylog2: GrayLogsManager,
 *     transports: TransportsManager
 * }}
 */
const internal = _this => {
	let data = storage.get(_this);
	if (!data) {
		data = {};
		storage.set(_this, data);
	}
	return data;
};

class Logger {
	constructor() {
		const privateThis = internal(this);
		this.formatting = new FormattingManager();
		this.console = new ConsoleLogsManager();
		this.file = new FileLogsManager();
		this.graylog2 = new GrayLogsManager();
		privateThis.transports = new TransportsManager();
		privateThis.transports.register(this.console, this.file, this.graylog2);
	}

	for(system) {
		const privateThis = internal(this);

		const transports = privateThis.transports.for(system);
		const logger = createLogger({
			levels: winston.config.syslog.levels,
			format: this.formatting.formatterFor(system),
			transports,
			exceptionHandlers: transports,
			exitOnError: true
		});

		Object.freeze(logger);

		return logger;
	}
}

export default Logger;
export { Logger };

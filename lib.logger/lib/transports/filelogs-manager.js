import DailyRotateFile from 'winston-daily-rotate-file';
import process from 'process';

const storage = new WeakMap();
/**
 * Private class data
 *
 * @param {Object} _this This of the class
 * @return {{
 *    transport: TransportStream
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

class FileLogsManager {
	constructor() {
		internal(this).transport = null;
	}

	setConfig(config) {
		// eslint-disable-next-line no-param-reassign
		config.filename = `${config.filename}.${process.pid}`;
		internal(this).transport = new DailyRotateFile(config);
	}

	get() {
		return internal(this).transport;
	}
}

export default FileLogsManager;
export { FileLogsManager };

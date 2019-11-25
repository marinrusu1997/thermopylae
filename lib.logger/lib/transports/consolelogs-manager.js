import { transports } from 'winston';

const storage = new WeakMap();
/**
 * Private class data
 *
 * @param {object} _this This of the class
 * @return {{
 *     transport: object
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

class ConsoleLogsManager {
	setConfig(options) {
		internal(this).transport = new transports.Console(options);
	}

	get() {
		const { transport } = internal(this);
		return transport || null;
	}
}

export default ConsoleLogsManager;
export { ConsoleLogsManager };

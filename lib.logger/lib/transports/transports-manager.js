const storage = new WeakMap();
/**
 * Private class data
 *
 * @param {object} _this This of the class
 * @return {{
 *    managers: Array<IAbstractLogsTransportManager>
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

class TransportsManager {
	constructor() {
		const privateThis = internal(this);
		privateThis.managers = [];
	}

	register(...transportManagers) {
		internal(this).managers.push(...transportManagers);
	}

	for(system) {
		const { managers } = internal(this);
		const transports = [];
		let transport;
		for (let i = 0; i < managers.length; i += 1) {
			transport = managers[i].get(system);
			if (transport) {
				transports.push(transport);
			}
		}
		if (!transports.length) {
			throw new Error(`No transports for ${system}`);
		}
		return transports;
	}
}

export default TransportsManager;
export { TransportsManager };

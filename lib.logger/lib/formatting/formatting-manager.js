import { format } from 'winston';

const storage = new WeakMap();
/**
 * Private class data
 *
 * @param {Object} _this This of the class
 * @return {{
 *     formatters: Map,
 *     recipe: Array<string>
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

/**
 * Adds predefined formatters to formatters map
 *
 * @param {Map<string, any>}  formatters  Internal formatters map
 */
function defineFormatters(formatters) {
	const { align, errors, splat, colorize, printf, json, prettyPrint } = format;
	formatters.set(
		'timestamp',
		format.timestamp({
			format: 'YYYY-MM-DD HH:mm:ss:SSS'
		})
	);
	formatters.set('align', align());
	formatters.set('errors', errors({ stack: true }));
	formatters.set('splat', splat());
	formatters.set('colorize', colorize({ all: true }));
	formatters.set(
		'printf',
		printf(info => {
			const { emitter, code, data, level, stack, label, timestamp } = info;
			if (emitter && code) {
				// eslint-disable-next-line no-param-reassign
				info.message = `${info.message}; Emitter: ${emitter}; Code: ${code}; Data: ${JSON.stringify(data)}`;
			}
			return `${timestamp} [${label}] ${level}: ${info.message || ''}${stack ? `\n${stack}` : ''}`;
		})
	);
	formatters.set('json', json({ space: 4 }));
	formatters.set('prettyPrint', prettyPrint({ depth: 3 }));
}

class FormattingManager {
	constructor() {
		const privateThis = internal(this);
		privateThis.formatters = new Map();
		defineFormatters(privateThis.formatters);
		this.applyOrderFor('PRINTF');
	}

	set(name, formatter) {
		const privateThis = internal(this);
		privateThis.formatters.set(name, formatter);
		privateThis.recipe = null;
	}

	remove(name) {
		const privateThis = internal(this);
		privateThis.formatters.delete(name);
		privateThis.recipe = null;
	}

	applyOrderFor(output, colorize) {
		const order = ['timestamp', 'errors', 'splat', 'align'];
		if (colorize) {
			order.push('colorize');
		}
		switch (output) {
			case 'PRINTF':
				order.push('printf');
				break;
			case 'JSON':
				order.push('json');
				break;
			case 'PRETTY_PRINT':
				order.push('prettyPrint');
				break;
			default:
				throw new Error('Invalid output format');
		}
		internal(this).recipe = order;
	}

	order(recipe) {
		const privateThis = internal(this);
		if (privateThis.recipe) {
			throw new Error('Order recipe configured already');
		}
		privateThis.recipe = recipe;
	}

	formatterFor(system) {
		const { formatters, recipe } = internal(this);
		const { combine, label } = format;
		/* check for recipe */
		if (!recipe) {
			throw new Error('Order recipe is not configured');
		}
		/* label formatter for system */
		const stagedFormatters = [label({ label: system })];
		/* prepare formatters in required order */
		let formatter;
		for (let i = 0; i < recipe.length; i += 1) {
			formatter = formatters.get(recipe[i]);
			if (!formatter) {
				throw new Error(`Formatter '${recipe[i]}' from the recipe is not registered`);
			}
			stagedFormatters.push(formatter);
		}
		/* combine all formatters into a single one */
		return combine(...stagedFormatters);
	}
}

export default FormattingManager;
export { FormattingManager };

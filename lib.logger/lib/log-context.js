import { ErrorCodes, ErrorMessages, LOG_CTX_COMPONENTS, generateToken } from '@marin/lib.utils';
import { createException } from './error';

const storage = new WeakMap();
/**
 * Private class data
 *
 * @param {Object} _this This of the class
 * @return {{
 *     ctx
 * }}
 */
const internal = _this => {
	return storage.get(_this);
};

let /** @type {string} */ ctxToken;
(async () => {
	ctxToken = (await generateToken(10)).plain;
})();

class LogContext {
	constructor() {
		storage.set(this, {
			ctx: null
		});
	}

	/**
	 * Private getter
	 *
	 * @param {string} token
	 */
	getContext(token) {
		if (token !== ctxToken) {
			throw createException(ErrorCodes.INCORRECT_TOKEN, ErrorMessages.INCORRECT_TOKEN);
		}
		const { ctx } = internal(this);
		if (!ctx) {
			throw createException(ErrorCodes.NOT_INITIALIZED, ErrorMessages.NOT_INITIALIZED);
		}
		return ctx;
	}

	/**
	 * Private setter for the context
	 *
	 * @param {object}	ctx
	 * @param {string}	token
	 */
	setContext(ctx, token) {
		if (token !== ctxToken) {
			throw createException(ErrorCodes.INCORRECT_TOKEN, ErrorMessages.INCORRECT_TOKEN);
		}
		internal(this).ctx = ctx;
	}

	/**
	 * Acts like a private constructor
	 *
	 * @param {object|string} contextFormat
	 *
	 * @return {LogContext}
	 */
	static from(contextFormat) {
		let ctx = {};
		if (typeof contextFormat === 'object') {
			ctx = contextFormat;
		}
		if (typeof contextFormat === 'string') {
			ctx = {};
			const contextParts = contextFormat.split('; ');
			for (let i = 0; i < contextParts.length; i += 1) {
				const [KEY, VALUE] = contextParts[i].split('=');
				ctx[KEY] = VALUE;
			}
		}
		const logContext = new LogContext();
		logContext.setContext(ctx, ctxToken);
		return logContext;
	}

	toString() {
		const ctx = this.getContext(ctxToken);
		const /** @type {Array<string>} */ contextParts = [];
		const /** @type {Array<string>} */ contextKeys = Object.keys(ctx);
		let /** @type {string} */ key;
		let /** @type {string | object} */ value;
		for (let i = 0; i < contextKeys.length; i += 1) {
			key = contextKeys[i];
			value = ctx[contextKeys[i]];
			contextParts.push(`${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`);
		}
		return contextParts.join('; ');
	}

	/**
	 * @returns {string}
	 */
	action() {
		return this.getContext(ctxToken)[LOG_CTX_COMPONENTS.ACTION];
	}

	/**
	 * @returns {string}
	 */
	resource() {
		return this.getContext(ctxToken)[LOG_CTX_COMPONENTS.RESOURCE];
	}

	/**
	 * @returns {object}
	 */
	variables() {
		const ctx = this.getContext(ctxToken);
		if (typeof ctx[LOG_CTX_COMPONENTS.VARIABLES] === 'string') {
			ctx[LOG_CTX_COMPONENTS.VARIABLES] = JSON.parse(ctx[LOG_CTX_COMPONENTS.VARIABLES]);
		}
		return ctx[LOG_CTX_COMPONENTS.VARIABLES];
	}

	/**
	 * @returns {string}
	 */
	status() {
		return this.getContext(ctxToken)[LOG_CTX_COMPONENTS.STATUS];
	}
}

// eslint-disable-next-line import/prefer-default-export
export { LogContext };

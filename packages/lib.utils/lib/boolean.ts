const TRUTHY_VALUES_REGEX = /^(?:1|on|true|y|yes)$/i;
const FALSY_VALUES_REGEX = /^(?:0|false|n|no|off)$/i;

/**
 * Convert given `value` to boolean equivalent.
 *
 * @param   value        Boolean like value.
 * @param   defaultValue Whether to throw when given value is `null`.
 *
 * @returns              Boolean equivalent.
 */
function convertFrom<T>(value: T, defaultValue = false): boolean {
	if (typeof value === 'boolean') {
		return value;
	}

	if (value == null) {
		return defaultValue;
	}

	if (TRUTHY_VALUES_REGEX.test(String(value).trim())) {
		return true;
	}

	if (FALSY_VALUES_REGEX.test(String(value).trim())) {
		return false;
	}

	throw new Error(`Value \`${value}\` can't be converted to a boolean value.`);
}

export { convertFrom };

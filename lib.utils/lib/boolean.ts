import { createException } from './exception';

const enum ErrorCodes {
	BOOLEAN_TYPE_CASTING_FAILED = 'BOOLEAN_TYPE_CASTING_FAILED'
}

/**
 * Convert given `value` to boolean equivalent.
 *
 * @param value				Boolean like value.
 * @param strictNullables	Whether to throw when given value is `null`.
 *
 * @returns		Boolean equivalent.
 */
function convertFrom(value: null | undefined | string | number | boolean, strictNullables?: boolean): boolean {
	const valueType = typeof value;

	if (valueType === 'undefined' || value === null) {
		if (strictNullables) {
			throw createException(ErrorCodes.BOOLEAN_TYPE_CASTING_FAILED, `Can't cast ${value} of type ${valueType} to boolean.`);
		}
		return false;
	}

	if (valueType === 'string') {
		value = (value as string).toLowerCase();
		if (value === 'true' || value === '1' || value === 'yes') {
			return true;
		}
		if (value === 'false' || value === '0' || value === 'no') {
			return false;
		}
	}

	if (valueType === 'number') {
		return Boolean(value);
	}

	if (valueType === 'boolean') {
		return value as boolean;
	}

	throw createException(ErrorCodes.BOOLEAN_TYPE_CASTING_FAILED, `Can't cast ${value} of type ${valueType} to boolean.`);
}

export { ErrorCodes, convertFrom };

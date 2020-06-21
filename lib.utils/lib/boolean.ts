import { createException } from './exception';

const enum ErrorCodes {
	BOOLEAN_TYPE_CASTING_FAILED = 'BOOLEAN_TYPE_CASTING_FAILED'
}

function toBoolean(value: null | undefined | string | number | boolean, strict?: boolean): boolean {
	const valueType = typeof value;

	if (valueType === 'undefined' || value === null) {
		if (strict) {
			throw createException(ErrorCodes.BOOLEAN_TYPE_CASTING_FAILED, `Can't cast ${value} of type ${valueType} to boolean.`);
		}
		return false;
	}

	if (valueType === 'string') {
		// @ts-ignore
		if (value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes') {
			return true;
		}
		// @ts-ignore
		if (value.toLowerCase() === 'false' || value === '0' || value.toLowerCase() === 'no') {
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

export { ErrorCodes, toBoolean };

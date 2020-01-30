import { createException } from './exception';

const enum ErrorCodes {
	BOOLEAN_TYPE_CASTING_FAILED = 'BOOLEAN_TYPE_CASTING_FAILED'
}

function toBoolean(value: null | undefined | string | number): boolean {
	const valueType = typeof value;

	if (valueType === 'undefined' || value === null) {
		return false;
	}

	if (valueType === 'string') {
		// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
		// @ts-ignore
		if (value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes') {
			return true;
		}
		// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
		// @ts-ignore
		if (value.toLowerCase() === 'false' || value === '0' || value.toLowerCase() === 'no') {
			return false;
		}
	}

	if (valueType === 'number') {
		return Boolean(value);
	}

	throw createException(ErrorCodes.BOOLEAN_TYPE_CASTING_FAILED, `Can't cast ${value} of type ${valueType} to boolean.`);
}

export { ErrorCodes, toBoolean };

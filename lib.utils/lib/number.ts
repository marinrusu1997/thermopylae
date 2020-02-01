import { createException } from './exception';

const enum ErrorCodes {
	NUMBER_TYPE_CASTING_FAILED = 'NUMBER_TYPE_CASTING_FAILED'
}

/**
 * Returns a random number between min (inclusive) and max (exclusive)
 */
function generateArbitraryNumber(min: number, max: number): number {
	return Math.random() * (max - min) + min;
}

/**
 * Returns a random integer between min (inclusive) and max (inclusive).
 * The value is no lower than min (or the next integer greater than min
 * if min isn't an integer) and no greater than max (or the next integer
 * lower than max if max isn't an integer).
 *
 * Using Math.round() will give you a non-uniform distribution!
 */
function generateRandomNumber(min: number, max: number): number {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Converts a giver value to it's corresponding number.
 * When strict mode is enabled, given undefined or null will throw an error
 * When strict mode is disabled, given undefined or null will return them back.
 *
 * @param value
 * @param strict
 */
function toNumber(value: boolean | number | string | null | undefined, strict?: boolean): number | null | undefined {
	if (typeof value === 'undefined' || value === null) {
		if (strict) {
			throw createException(ErrorCodes.NUMBER_TYPE_CASTING_FAILED, '');
		}
		return value;
	}
	return Number(value);
}

export { generateArbitraryNumber, generateRandomNumber, toNumber, ErrorCodes };

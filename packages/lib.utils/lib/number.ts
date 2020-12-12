import { createException } from './exception';

const enum ErrorCodes {
	NUMBER_TYPE_CASTING_FAILED = 'NUMBER_TYPE_CASTING_FAILED',
	GREATER_THAN = 'GREATER_THAN',
	INVALID_RANGE = 'INVALID_RANGE'
}

/**
 * Returns a random number between min (inclusive) and max (exclusive)
 *
 * @param min	Minimum value.
 * @param max	Maximum value.
 *
 * @returns		Random number.
 */
function random(min: number, max: number): number {
	if (min > max) {
		throw createException(ErrorCodes.GREATER_THAN, `${min} is greater than ${max}`);
	}

	return Math.random() * (max - min) + min;
}

/**
 * Returns a random integer between min (inclusive) and max (inclusive).
 * The value is no lower than min (or the next integer greater than min
 * if min isn't an integer) and no greater than max (or the next integer
 * lower than max if max isn't an integer).
 *
 * @param min	Minimum value.
 * @param max	Maximum value.
 *
 * @returns		Random integer.
 */
function randomInt(min: number, max: number): number {
	if (min > max) {
		throw createException(ErrorCodes.GREATER_THAN, `${min} is greater than ${max}`);
	}

	min = Math.ceil(min);
	max = Math.floor(max);

	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calculates `percentage` from a `number`.
 *
 * @param number	Number.
 * @param percent	Percent from that number.
 *
 * @returns		Number which represents `percent` from `number`.
 */
function percentage(number: number, percent: number): number {
	if (percent < 0 || percent > 1) {
		throw createException(ErrorCodes.INVALID_RANGE, 'Percentage needs to be between 0 and 1.');
	}
	return percent * number;
}

/**
 * Converts a giver value to it's corresponding number.
 *
 * @param value				Number like value.
 * @param strictNullables	How to thread nullable values.
 * 							When enabled, given undefined or null will throw an error
 * 							When disabled, given undefined or null will return them back.
 *
 * @returns	Converted `value` to number.
 */
function convertFrom(value: boolean | number | string | null | undefined, strictNullables?: boolean): number | null | undefined {
	if (typeof value === 'undefined' || value === null) {
		if (strictNullables) {
			throw createException(ErrorCodes.NUMBER_TYPE_CASTING_FAILED, '');
		}
		return value;
	}
	return Number(value);
}

/**
 * This does not start with the numbers to generate valid variable-names.
 */
const base58Chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ123456789';
const base58Length = base58Chars.length;

/**
 * Transform a number to a string by using only base58 chars.
 *
 * @param nr	Number to convert.
 *
 * @returns The string-representation of the number.
 */
function toLetter(nr: number): string {
	// see https://github.com/matthewmueller/number-to-letter/blob/master/index.js

	const digits = [];
	do {
		const v = nr % base58Length;
		digits.push(v);
		nr = Math.floor(nr / base58Length);
		// eslint-disable-next-line no-plusplus
	} while (nr-- > 0);

	return digits
		.reverse()
		.map((d) => base58Chars[d])
		.join('');
}

export { random, randomInt, percentage, convertFrom, toLetter, ErrorCodes };

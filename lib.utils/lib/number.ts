import { createException } from './exception';

const enum ErrorCodes {
	NUMBER_TYPE_CASTING_FAILED = 'NUMBER_TYPE_CASTING_FAILED'
}

/**
 * Returns a random number between min (inclusive) and max (exclusive)
 */
function generateArbitrary(min: number, max: number): number {
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
function generateRandom(min: number, max: number): number {
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

/**
 * @link https://de.wikipedia.org/wiki/Base58
 * this does not start with the numbers to generate valid variable-names
 */
const base58Chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ123456789';
const base58Length: number = base58Chars.length;

/**
 * transform a number to a string by using only base58 chars
 * @link https://github.com/matthewmueller/number-to-letter/blob/master/index.js
 * @param nr                                       | 10000000
 * @return the string-representation of the number | '2oMX'
 */
function toLetter(nr: number): string {
	const digits = [];
	do {
		const v = nr % base58Length;
		digits.push(v);
		nr = Math.floor(nr / base58Length);
		// eslint-disable-next-line no-plusplus
	} while (nr-- > 0);

	return digits
		.reverse()
		.map(d => base58Chars[d])
		.join('');
}

export { generateArbitrary, generateRandom, toNumber, toLetter, ErrorCodes };

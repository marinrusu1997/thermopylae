import type { Percentage } from '@thermopylae/core.declarations';
import { createException } from './exception.js';

const enum ErrorCodes {
	NUMBER_TYPE_CASTING_FAILED = 'NUMBER_TYPE_CASTING_FAILED',
	GREATER_THAN = 'GREATER_THAN',
	INVALID_RANGE = 'INVALID_RANGE',
	INVALID_ARGUMENT = 'INVALID_ARGUMENT'
}

/**
 * Returns a random number between min (inclusive) and max (exclusive)
 *
 * @param   min Minimum value.
 * @param   max Maximum value.
 *
 * @returns     Random number.
 */
function random(min: number, max: number): number {
	if (min > max) {
		throw createException(ErrorCodes.GREATER_THAN, `${min} is greater than ${max}`);
	}

	return Math.random() * (max - min) + min;
}

/**
 * Returns a random integer between min (inclusive) and max (inclusive). The value is no lower than
 * min (or the next integer greater than min if min isn't an integer) and no greater than max (or
 * the next integer lower than max if max isn't an integer).
 *
 * @param   min Minimum value.
 * @param   max Maximum value.
 *
 * @returns     Random integer.
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
 * Asserts that _value_ is an integer.
 *
 * @param  value           Value to check.
 *
 * @throws {Exception}       When _value_ is not an integer.
 */
function assertIsInteger(value: any): void | never {
	if (!Number.isInteger(value)) {
		throw createException(ErrorCodes.INVALID_ARGUMENT, `${JSON.stringify(value)} is not an integer.`);
	}
}

/**
 * Asserts that _num_ represents a percentage and has a value in the [0,1] interval.
 *
 * @param  num           Number to test.
 *
 * @throws {Exception}     When _num_ is not a percentage.
 */
function assertIsPercentage(num: number): void | never {
	if (num < 0 || num > 1) {
		throw createException(ErrorCodes.INVALID_RANGE, 'Percentage needs to be in the [0,1] interval.');
	}
}

/**
 * Calculates `percentage` from a `number`.
 *
 * @param   number  Number.
 * @param   percent Percent from that number.
 *
 * @returns         Number which represents `percent` from `number`.
 */
function percentage(number: number, percent: Percentage): number {
	assertIsPercentage(percent);
	return percent * number;
}

/**
 * Calculates `percentage` from a `number` as an integer. <br/> Integer is obtained by using
 * {@link Math.round}.
 *
 * @param   number  Number.
 * @param   percent Percent from that number.
 *
 * @returns         Integer number which represents `percent` from `number`.
 */
function integerPercentage(number: number, percent: Percentage): number {
	return Math.round(percentage(number, percent));
}

/**
 * Converts a giver value to it's corresponding number.
 *
 * @param   value           Number like value.
 * @param   strictNullables How to thread nullable values. When enabled, given undefined or null
 *   will throw an error When disabled, given undefined or null will return them back.
 *
 * @returns                 Converted `value` to number.
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

/** This does not start with the numbers to generate valid variable-names. */
const base58Chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ123456789';
const base58Length = base58Chars.length;

/**
 * Transform a number to a string by using only base58 chars.
 *
 * @param   nr Number to convert.
 *
 * @returns    The string-representation of the number.
 */
function toLetter(nr: number): string {
	// see https://github.com/matthewmueller/number-to-letter/blob/master/index.js

	const digits = [];
	do {
		const v = nr % base58Length;
		digits.push(v);
		nr = Math.floor(nr / base58Length);
	} while (nr-- > 0);

	return digits
		.reverse()
		.map((d) => base58Chars[d])
		.join('');
}

export { random, randomInt, assertIsInteger, assertIsPercentage, percentage, integerPercentage, convertFrom, toLetter, ErrorCodes };

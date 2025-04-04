import type { Percentage } from '@thermopylae/core.declarations';
import { createException } from './exception.js';

enum ErrorCodes {
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
 * Asserts that _value_ is an integer.
 *
 * @param value Value to check.
 */
function assertIsInteger<T>(value: T): void | never {
	if (!Number.isInteger(value)) {
		throw createException(ErrorCodes.INVALID_ARGUMENT, `${JSON.stringify(value)} is not an integer.`);
	}
}

/**
 * Asserts that _num_ represents a percentage and has a value in the [0,1] interval.
 *
 * @param num Number to test.
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
	if (value == null) {
		if (strictNullables) {
			throw createException(ErrorCodes.NUMBER_TYPE_CASTING_FAILED, '');
		}
		return value;
	}
	return Number(value);
}

/** This does not start with the numbers to generate valid variable-names. */
const base58Chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ123456789' as const;
const base58Length = base58Chars.length;

function digitToBase58Char(digit: number): string {
	return base58Chars[digit];
}

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

	return digits.reverse().map(digitToBase58Char).join('');
}

export { random, assertIsInteger, assertIsPercentage, percentage, integerPercentage, convertFrom, toLetter, ErrorCodes };

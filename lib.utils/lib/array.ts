import { UnaryPredicate, SyncFunction, ConcurrencyType, UnaryPredicateAsync } from '@thermopylae/core.declarations';
import { generateRandomInt } from './number';
import { createException } from './exception';

const enum ErrorCodes {
	NOT_SUPPORTED = 'NOT_SUPPORTED'
}

/**
 * Removes element from `array`.
 * @link https://stackoverflow.com/a/15996017
 *
 * @param array				Initial array.
 * @param predicate			Predicate function to mach needed element.
 * @param inPlace			Whether to remove elements from the original array.
 * 							When `false` will create a clone and removal will be made from that clone.
 * @param firstOccurrence	Whether to remove the first, or all of the occurrences of the found element.
 *
 * @returns	Array with removed elements.
 */
function remove<T>(array: Array<T>, predicate: UnaryPredicate<T>, inPlace = true, firstOccurrence = true): Array<T> {
	if (!inPlace) {
		array = array.slice();
	}
	let i = array.length;
	// eslint-disable-next-line no-plusplus
	while (i--) {
		if (predicate(array[i])) {
			array.splice(i, 1);
			if (firstOccurrence) {
				break;
			} else {
				continue;
			}
		}
	}
	return array;
}

/**
 * Creates a new array which contains unique items.
 *
 * @param items
 */
function extractUnique<T>(items: Array<T>): Array<T> {
	return Array.from(new Set(items));
}

/**
 * Shuffle the given array.
 *
 * @param arr	Initial array.
 */
function shuffle<T>(arr: T[]): void {
	arr.sort(() => Math.random() - 0.5);
}

/**
 * Creates a new array which contains the given value.
 *
 * @param length	Number of elements.
 * @param value		Value to fill with. For dynamical filling, provide a function.
 *
 * @returns		Filled array.
 */
function filledWith<T>(length: number, value: T | SyncFunction<void, T>): Array<T> {
	const array = new Array<T>(length);

	if (length !== 0) {
		if (typeof value === 'function') {
			for (let i = 0; i < length; i++) {
				array[i] = (value as SyncFunction<void, T>)();
			}
		} else {
			array.fill(value);
		}
	}

	return array;
}

/**
 * Extract a random element from the given `array`.
 *
 * @param array		Source data array.
 *
 * @returns Random element.
 */
function randomElement<T>(array: Array<T>): T {
	return array[generateRandomInt(0, array.length - 1)];
}

/**
 * Filter array asynchronously.
 *
 * @param array			Initial array.
 * @param predicate		Async predicate.
 * @param [concurrency]	Filtering concurrency.
 *
 * @returns Filtered elements.
 */
function filterAsync<T>(array: Array<T>, predicate: UnaryPredicateAsync<T>, concurrency = ConcurrencyType.PARALLEL): Promise<Array<T>> {
	switch (concurrency) {
		case ConcurrencyType.PARALLEL:
			return Promise.all(array.map(predicate)).then((results) => array.filter((_, index) => results[index]));
		case ConcurrencyType.SEQUENTIAL:
			return array.reduce(async (memo: Promise<T[]>, e: T) => [...(await memo), ...((await predicate(e)) ? [e] : [])], Promise.resolve([]));
		default:
			return Promise.reject(createException(ErrorCodes.NOT_SUPPORTED, `Can't handle given concurrency ${concurrency}.`));
	}
}

export { remove, extractUnique, shuffle, filledWith, randomElement, filterAsync };

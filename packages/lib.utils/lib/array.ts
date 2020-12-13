import { UnaryPredicate, SyncFunction, ConcurrencyType, UnaryPredicateAsync } from '@thermopylae/core.declarations';
import { randomInt } from './number';
import { createException } from './exception';

const enum ErrorCodes {
	NOT_SUPPORTED = 'NOT_SUPPORTED',
	NOT_FOUND = 'NOT_FOUND',
	UNKNOWN = 'UNKNOWN'
}

/**
 * Removes element from `array`.
 *
 * @template T	Elements type.
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
	// inspired from https://stackoverflow.com/a/15996017

	if (!inPlace) {
		array = array.slice();
	}

	for (let i = 0; i < array.length; i++) {
		if (predicate(array[i])) {
			array.splice(i, 1);
			if (firstOccurrence) {
				break;
			}
			i -= 1; // length decreases, i has to do so too
		}
	}

	return array;
}

/**
 * Creates a new array which contains unique items.
 *
 * @template T		Elements type.
 *
 * @param array		Input array.
 *
 * @returns			Array with unique items.
 */
function unique<T>(array: Array<T>): Array<T> {
	return Array.from(new Set(array));
}

/**
 * Shuffle the given array in-place.
 *
 * @template T	Elements type.
 *
 * @param arr	Initial array.
 *
 * @returns 	Same array, but shuffled.
 */
function shuffle<T>(arr: T[]): T[] {
	arr.sort(() => Math.random() - 0.5);
	return arr;
}

interface FilledWithOptions {
	/**
	 * Prevent filling with duplicates when values are generated dynamically.
	 */
	noDuplicates: boolean;
}

/**
 * Creates a new array which contains the given `value`.
 *
 * @template T	Elements type.
 *
 * @param length	Number of elements.
 * @param value		Value to fill with. For dynamical filling, provide a function.
 * @param opts		Fill options.
 *
 * @returns		Filled array.
 */
function filledWith<T>(length: number, value: T | SyncFunction<void, T>, opts?: FilledWithOptions): Array<T> {
	const array = new Array<T>(length);

	if (length !== 0) {
		if (typeof value === 'function') {
			if (opts && opts.noDuplicates) {
				const generatedValues = new Set<T>();
				for (let i = 0; i < length; i++) {
					while (generatedValues.has((array[i] = (value as SyncFunction<void, T>)())));
					generatedValues.add(array[i]);
				}
			} else {
				// duplicated for performance
				for (let i = 0; i < length; i++) {
					array[i] = (value as SyncFunction<void, T>)();
				}
			}
		} else {
			array.fill(value);
		}
	}

	return array;
}

/**
 * Position in the array from where to peek element.
 */
const enum PeekPosition {
	/**
	 * Beginning of the array.
	 */
	BEGIN,
	/**
	 * End of the array.
	 */
	END
}

/**
 * Peek last item from array.
 *
 * @param array		Array with elements.
 * @param position	Peek position.
 *
 * @throws When array is empty.
 *
 * @returns Array element.
 */
function peek<T>(array: Array<T>, position = PeekPosition.END): T {
	if (!array.length) {
		throw createException(ErrorCodes.NOT_FOUND, 'Array is empty.');
	}

	switch (position) {
		case PeekPosition.BEGIN:
			return array[0];
		case PeekPosition.END:
			return array[array.length - 1];
		default:
			throw createException(ErrorCodes.UNKNOWN, `Unknown peek position. Given: ${position}.`);
	}
}

/**
 * Extract a random element from the given `array`.
 *
 * @template T	Elements type.
 *
 * @param array	Source data array.
 *
 * @returns Random element.
 */
function randomElement<T>(array: Array<T>): T {
	return array[randomInt(0, array.length - 1)];
}

/**
 * Filter array asynchronously.
 *
 * @template T	Elements type.
 *
 * @param array			Initial array.
 * @param predicate		Async predicate.
 * @param concurrency	Filtering concurrency.
 *
 * @returns Filtered elements.
 */
async function filterAsync<T>(array: Array<T>, predicate: UnaryPredicateAsync<T>, concurrency = ConcurrencyType.PARALLEL): Promise<Array<T>> {
	switch (concurrency) {
		case ConcurrencyType.PARALLEL:
			return Promise.all(array.map(predicate)).then((results) => array.filter((_, index) => results[index]));
		case ConcurrencyType.SEQUENTIAL: {
			const results = new Array<T>();
			for (const item of array) {
				if (await predicate(item)) {
					results.push(item);
				}
			}
			return results;
		}
		default:
			return Promise.reject(createException(ErrorCodes.NOT_SUPPORTED, `Can't handle given concurrency ${concurrency}.`));
	}
}

export { remove, unique, shuffle, filledWith, peek, PeekPosition, randomElement, filterAsync, FilledWithOptions };

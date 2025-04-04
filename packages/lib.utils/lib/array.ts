import { ConcurrencyType, type UnaryPredicate, type UnaryPredicateAsync } from '@thermopylae/core.declarations';
import shuffle from 'knuth-shuffle-seeded';
import { createException } from './exception.js';

enum ErrorCodes {
	NOT_SUPPORTED = 'NOT_SUPPORTED',
	NOT_FOUND = 'NOT_FOUND',
	UNKNOWN = 'UNKNOWN'
}

/**
 * Removes element from `array`.
 *
 * @template T Elements type.
 *
 * @param   array           Initial array.
 * @param   predicate       Predicate function to mach needed element.
 * @param   inPlace         Whether to remove elements from the original array. When `false` will
 *   create a clone and removal will be made from that clone.
 * @param   firstOccurrence Whether to remove the first, or all of the occurrences of the found
 *   element.
 *
 * @returns                 Array with removed elements.
 */
function remove<T>(array: T[], predicate: UnaryPredicate<T>, inPlace = true, firstOccurrence = true): T[] {
	// inspired from https://stackoverflow.com/a/15996017

	if (!inPlace) {
		array = [...array];
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
 * Removes an _item_ in place from _array_.
 *
 * @param   array Array from where to remove.
 * @param   item  Item to remove.
 *
 * @returns       Boolean which indicates whether _item_ was removed.
 */
function removeInPlace<T>(array: T[], item: T): boolean {
	const index = array.indexOf(item);
	if (index !== -1) {
		array.splice(index, 1);
		return true;
	}
	return false;
}

/**
 * Creates a new array which contains unique items.
 *
 * @template T Elements type.
 *
 * @param   array Input array.
 *
 * @returns       Array with unique items.
 */
function unique<T>(array: readonly T[]): T[] {
	return [...new Set(array)];
}

/** Position in the array from where to peek element. */
enum PeekPosition {
	/** Beginning of the array. */
	BEGIN = 0,
	/** End of the array. */
	END = 1
}

/**
 * Peek last item from array.
 *
 * @param   array    Array with elements.
 * @param   position Peek position.
 *
 * @returns          Array element.
 *
 * @throws           When array is empty.
 */
function peek<T>(array: readonly T[], position = PeekPosition.END): T {
	if (array.length === 0) {
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
 * Filter array asynchronously.
 *
 * @template T Elements type.
 *
 * @param   array       Initial array.
 * @param   predicate   Async predicate.
 * @param   concurrency Filtering concurrency.
 *
 * @returns             Filtered elements.
 */
async function filterAsync<T>(array: T[], predicate: UnaryPredicateAsync<T>, concurrency = ConcurrencyType.PARALLEL): Promise<T[]> {
	switch (concurrency) {
		case ConcurrencyType.PARALLEL:
			return Promise.all(array.map(predicate)).then((results) => array.filter((_, index) => results[index]));

		case ConcurrencyType.SEQUENTIAL: {
			const results = new Array<T>();
			for (const item of array) {
				// oxlint-disable-next-line no-await-in-loop
				if (await predicate(item)) {
					results.push(item);
				}
			}
			return results;
		}

		default:
			throw createException(ErrorCodes.NOT_SUPPORTED, `Can't handle given concurrency ${concurrency}.`);
	}
}

function mapArrayIndex<T>(_: T, index: number): number {
	return index;
}

/**
 * Creates a function which returns a random item from an array without repetition on each of its
 * calls.
 *
 * @param   array Array from where to get items.
 *
 * @returns       Function.
 */
function randomUniqueItem<T>(array: readonly T[]): () => T {
	if (!Array.isArray(array) || array.length === 0) {
		throw new Error(`'array' must be a non-empty array`);
	}

	let indexes = shuffle(array.map(mapArrayIndex));
	let iterator = 0;

	return (): T => {
		if (iterator === indexes.length) {
			indexes = shuffle(array.map(mapArrayIndex));
			iterator = 0;
		}

		return array[indexes[iterator++]];
	};
}

export { remove, removeInPlace, unique, peek, PeekPosition, filterAsync, randomUniqueItem };

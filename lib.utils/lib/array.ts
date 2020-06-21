import { UnaryPredicate, SyncFunction } from '@thermopylae/core.declarations';

/**
 * @link https://stackoverflow.com/a/15996017
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
 * Creates a new array which contains unique items
 *
 * @param items
 */
function extractUnique<T>(items: Array<T>): Array<T> {
	return Array.from(new Set(items));
}

/**
 * shuffle the given array
 */
function shuffle<T>(arr: T[]): T[] {
	return arr.sort(() => Math.random() - 0.5);
}

function filledWith<T>(length: number, value: T | SyncFunction<void, T>): Array<T> {
	const array = new Array<T>(length);

	if (typeof value === 'function') {
		for (let i = 0; i < length; i++) {
			array[i] = (value as SyncFunction<void, T>)();
		}
	} else {
		array.fill(value);
	}

	return array;
}

export { remove, extractUnique, shuffle, filledWith };

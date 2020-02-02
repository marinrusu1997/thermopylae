import { UnaryPredicate } from './declarations';

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

export { remove, extractUnique, shuffle };

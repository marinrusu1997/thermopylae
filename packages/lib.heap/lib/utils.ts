import { ComparisonResult } from '@thermopylae/core.declarations';

/**
 * Function which compares {@link Heap} values.
 *
 * @template T	Element type.
 */
interface CompareFunction<T> {
	(first: T, second: T): ComparisonResult;
}

/**
 * Function signature for checking equality of array elements.
 *
 * @template T	Element type.
 */
interface ArrayEqualsPredicate<T> {
	(value: T, index: number, obj: T[]): boolean;
}

/**
 * Default function to compare element order.
 *
 * @internal
 */
function defaultCompare<T>(a: T, b: T): number {
	if (a < b) {
		return -1;
	}

	if (a === b) {
		return 0;
	}

	return 1;
}

export { CompareFunction, ArrayEqualsPredicate, defaultCompare };

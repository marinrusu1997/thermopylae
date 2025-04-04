/**
 * Function signature for checking equality of array elements.
 *
 * @template T Element type.
 */
type ArrayEqualsPredicate<T> = (value: T, index: number, obj: T[]) => boolean;

/**
 * Default function to compare element order.
 *
 * @private
 */
function defaultCompare<T>(first: T, second: T): number {
	if (first < second) {
		return -1;
	}

	if (first === second) {
		return 0;
	}

	return 1;
}

export { type ArrayEqualsPredicate, defaultCompare };

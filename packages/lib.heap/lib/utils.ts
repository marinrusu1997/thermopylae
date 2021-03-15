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

export { ArrayEqualsPredicate, defaultCompare };

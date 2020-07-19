import { ComparisonResult } from '@thermopylae/core.declarations';

/**
 * Function signature for comparing
 * <0 means a is smaller
 * = 0 means they are equal
 * >0 means a is larger
 */
interface CompareFunction<T> {
	(a: T, b: T): ComparisonResult;
}

/**
 * Function signature for checking equality.
 */
interface ArrayEqualsPredicate<T> {
	(value: T, index: number, obj: T[]): boolean;
}

/**
 * Default function to compare element order.
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

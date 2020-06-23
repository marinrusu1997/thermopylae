import lodashClone from 'lodash.clone';
import lodashCloneDeep from 'lodash.clonedeep';

function clone<T>(value: T): T {
	return lodashClone(value);
}

function cloneDeep<T>(value: T): T {
	return lodashCloneDeep(value);
}

function isObject(item: unknown): boolean {
	return typeof item === 'object' && !Array.isArray(item) && item !== null;
}

function isEmpty(obj: Record<string, unknown>): boolean {
	return Object.entries(obj).length === 0 && obj.constructor === Object;
}

/**
 * Processor for object leafs. After processing it must return new value or the old one.
 */
type TraverseProcessor = (key: string, value: undefined | null | boolean | number | string) => undefined | null | boolean | number | string;

/**
 * Iterates over a provided object and processes it's leafs using provided processor.
 * After processing it must return new value or the old one !!!
 * If can option for altering of a clone of the provided object.
 *
 * @param objectOrArray			Object which needs to be iterated.
 * @param processor			Leaf processor
 * @param alterDeepClone	Alter a deep clone instead of the provided object.
 */
function traverse(objectOrArray: Record<string, unknown> | Array<any>, processor: TraverseProcessor, alterDeepClone?: boolean): Record<string, unknown> {
	const isArray = Array.isArray(objectOrArray);

	if (alterDeepClone && !isArray) {
		objectOrArray = cloneDeep(objectOrArray);
	}

	let currentPath = '';

	function traverseArray(arr: Array<any>, pathSeparator: string): void {
		const appendIndex = currentPath.length;
		for (let i = 0; i < arr.length; i++) {
			currentPath += `${pathSeparator}[${i}]`;
			continueTraversal(arr, i, arr[i]);
			currentPath = currentPath.substring(0, appendIndex);
		}
	}

	function traverseObject(obj: Record<string, unknown>, pathSeparator: string): void {
		const keys = Object.getOwnPropertyNames(obj);
		const appendIndex = currentPath.length;
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];
			currentPath += `${pathSeparator}${key}`;
			// @ts-ignore
			continueTraversal(obj, key, obj[key]);
			currentPath = currentPath.substring(0, appendIndex);
		}
	}

	function continueTraversal(currentObject: Record<string, unknown> | Array<any>, key: string | number, value: any): void {
		if (Array.isArray(value)) {
			traverseArray(value, '.');
		} else if (typeof value === 'object' && value !== null) {
			traverseObject(value, '.');
		} else if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string' || typeof value === 'undefined' || value === null) {
			// @ts-ignore
			currentObject[key] = processor(currentPath, value);
		}
	}

	if (isArray) {
		traverseArray(objectOrArray as Array<any>, '');
	} else {
		traverseObject(objectOrArray as Record<string, unknown>, '');
	}

	return objectOrArray as Record<string, unknown>;
}

/**
 * deep-sort an object so its attributes are in lexical order.
 * Also sorts the arrays inside of the object if sortArray is set
 */
function sort(obj: Record<string, unknown>, sortArray = true): Record<string, unknown> {
	return doSortObject(obj, sortArray) as Record<string, unknown>;
}
function doSortObject(obj: Record<string, unknown>, sortArray = true): Record<string, unknown> | Array<any> {
	if (!obj) return obj; // do not sort null, false or undefined

	// array
	if (Array.isArray(obj)) {
		return !sortArray
			? obj
			: obj
					.sort((a, b) => {
						if (typeof a === 'string' && typeof b === 'string') {
							return a.localeCompare(b);
						}

						return typeof a === 'object' ? 1 : -1;
					})
					.map((i) => sort(i, sortArray));
	}

	// object
	if (typeof obj === 'object') {
		if (obj instanceof RegExp) {
			return obj;
		}

		const out: Record<string, unknown> = {};
		Object.keys(obj)
			.sort((a, b) => a.localeCompare(b))
			.forEach((key) => {
				// @ts-ignore
				out[key] = sort(obj[key], sortArray);
			});
		return out;
	}

	// everything else
	return obj;
}

/**
 * returns a flattened object
 * @link https://gist.github.com/penguinboy/762197
 */
function flatten(obj: Record<string, unknown>): Record<string, unknown> | null {
	if (obj === null) {
		return null;
	}

	const toReturn: any = {};

	// eslint-disable-next-line no-restricted-syntax
	for (const objKey in obj) {
		if (!Object.prototype.hasOwnProperty.call(obj, objKey)) {
			continue;
		}

		const adjustedObjKey = `${Array.isArray(obj) ? `[${objKey}]` : `${objKey}`}`;

		// @ts-ignore
		if (typeof obj[objKey] === 'object') {
			// @ts-ignore
			const flatObject = flatten(obj[objKey]);
			if (flatObject === null) {
				// @ts-ignore
				toReturn[adjustedObjKey] = flatObject;
			} else {
				// eslint-disable-next-line no-restricted-syntax, guard-for-in
				for (const flatObjectKey in flatObject) {
					// @ts-ignore
					toReturn[`${adjustedObjKey}.${flatObjectKey}`] = flatObject[flatObjectKey];
				}
			}
		} else {
			// @ts-ignore
			toReturn[adjustedObjKey] = obj[objKey];
		}
	}
	return toReturn;
}

export { clone, cloneDeep, isObject, isEmpty, traverse, TraverseProcessor, sort, flatten };

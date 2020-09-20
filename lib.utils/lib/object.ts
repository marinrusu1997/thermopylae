import lodashClone from 'lodash.clone';
import fastCopy from 'fast-copy';
import { Nullable, ObjMap } from '@thermopylae/core.declarations';

/**
 * Clone top level properties of the object.
 *
 * @param value		Object to be cloned.
 *
 * @returns	Shallow copy of the object.
 */
function clone<T>(value: T): T {
	return lodashClone(value);
}

/**
 * Create a deep copy of the object.
 *
 * @param value		Object to be cloned.
 *
 * @returns Deep copy of the object.
 */
function cloneDeep<T>(value: T): T {
	return fastCopy(value);
}

/**
 * Verify if `value` is an object.
 *
 * @param value		Value to test for.
 *
 * @returns  Whether value is an object.
 */
function isObject<T>(value: T): boolean {
	return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Verify if object is empty and contains no keys.
 *
 * @template T	Object type.
 *
 * @param obj	Object to test for.
 *
 * @returns Whether object is empty.
 */
function isEmpty<T extends ObjMap>(obj: T): boolean {
	return Object.entries(obj).length === 0 && obj.constructor === Object;
}

interface TraverseProcessor {
	/**
	 * Processor for object leaves.
	 * After processing it must return new value or the old one.
	 *
	 * @param currentPath	Path to current property in dot notation.
	 * @param value			Value of current property.
	 *
	 * @returns	Processed value.
	 */
	(currentPath: string, value: undefined | null | boolean | number | string): undefined | null | boolean | number | string;
}

/**
 * Iterates over a provided object and processes it's leaves using provided processor.
 * After processing it must return new value or the old one.
 *
 * @param objectOrArray			Object which needs to be iterated.
 * @param processor				Leaf processor
 * @param alterDeepClone		Alter a deep clone instead of the provided object.
 *
 * @returns	Traversed object which might be altered by `processor`.
 */
function traverse(objectOrArray: ObjMap | Array<unknown>, processor: TraverseProcessor, alterDeepClone?: boolean): ObjMap {
	const isArray = Array.isArray(objectOrArray);

	if (alterDeepClone && !isArray) {
		objectOrArray = cloneDeep(objectOrArray);
	}

	let currentPath = '';

	function traverseArray(arr: Array<unknown>, pathSeparator: string): void {
		const appendIndex = currentPath.length;
		for (let i = 0; i < arr.length; i++) {
			currentPath += `${pathSeparator}[${i}]`;
			continueTraversal(arr, i, arr[i]);
			currentPath = currentPath.substring(0, appendIndex);
		}
	}

	function traverseObject(obj: ObjMap, pathSeparator: string): void {
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

	function continueTraversal(currentObject: ObjMap | Array<unknown>, key: string | number, value: unknown): void {
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
		traverseArray(objectOrArray as Array<unknown>, '');
	} else {
		traverseObject(objectOrArray as ObjMap, '');
	}

	return objectOrArray as ObjMap;
}

/**
 * Deep-sort an object so its attributes are in lexical order.
 *
 * @param obj			Object to sort.
 * @param sortArray		Whether to sort the arrays inside of the object.
 *
 * @returns	Sorted object.
 */
function sort(obj: ObjMap, sortArray = true): ObjMap {
	return doSortObject(obj, sortArray) as ObjMap;
}
/**
 * @param obj
 * @param sortArray
 * @internal
 */
function doSortObject(obj: ObjMap, sortArray = true): ObjMap | Array<unknown> {
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

		const out: ObjMap = {};
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
 * Flatten an object, by creating a new one, having all of the nested keys top level.
 *
 * @param obj	Object to be flattened.
 *
 * @returns	Flattened object.
 */
function flatten(obj: ObjMap): Nullable<ObjMap> {
	// see https://gist.github.com/penguinboy/762197

	if (obj === null) {
		return null;
	}

	const toReturn = {};

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

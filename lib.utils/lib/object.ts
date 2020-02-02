import clone from 'lodash.clone';
import cloneDeep from 'lodash.clonedeep';

function isObject(item: any): boolean {
	return typeof item === 'object' && !Array.isArray(item) && item !== null;
}

function isEmpty(obj: object): boolean {
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function traverse(objectOrArray: object | Array<any>, processor: TraverseProcessor, alterDeepClone?: boolean): object {
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

	function traverseObject(obj: object, pathSeparator: string): void {
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

	function continueTraversal(currentObject: object | Array<any>, key: string | number, value: any): void {
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
		traverseObject(objectOrArray, '');
	}

	return objectOrArray;
}

/**
 * deep-sort an object so its attributes are in lexical order.
 * Also sorts the arrays inside of the object if sortArray is set
 */
function sort(obj: object, sortArray = true): object {
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
					.map(i => sort(i, sortArray));
	}

	// object
	if (typeof obj === 'object') {
		if (obj instanceof RegExp) {
			return obj;
		}

		const out: object = {};
		Object.keys(obj)
			.sort((a, b) => a.localeCompare(b))
			.forEach(key => {
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
function flatten(obj: object): object {
	if (obj === null) {
		// @ts-ignore
		return null;
	}

	const toReturn: any = {};

	for (const objKey in obj) {
		// eslint-disable-next-line no-prototype-builtins
		if (!obj.hasOwnProperty(objKey)) {
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
				// eslint-disable-next-line guard-for-in
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

// eslint-disable-next-line no-undef
export { clone, cloneDeep, isObject, isEmpty, traverse, TraverseProcessor, sort, flatten };

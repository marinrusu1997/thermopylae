import clone from 'lodash.clone';
import cloneDeep from 'lodash.clonedeep';

/**
 * Check if the provided object contains values.
 *
 * @param obj
 */
function isEmptyObject(obj: object): boolean {
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
		// eslint-disable-next-line no-param-reassign
		objectOrArray = cloneDeep(objectOrArray);
	}

	let currentPath = '';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function traverseArray(arr: Array<any>, pathSeparator: string): void {
		const appendIndex = currentPath.length;
		for (let i = 0; i < arr.length; i++) {
			currentPath += `${pathSeparator}[${i}]`;
			// eslint-disable-next-line no-use-before-define, @typescript-eslint/no-use-before-define
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
			// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
			// @ts-ignore
			// eslint-disable-next-line no-use-before-define, @typescript-eslint/no-use-before-define
			continueTraversal(obj, key, obj[key]);
			currentPath = currentPath.substring(0, appendIndex);
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function continueTraversal(currentObject: object | Array<any>, key: string | number, value: any): void {
		if (Array.isArray(value)) {
			traverseArray(value, '.');
		} else if (typeof value === 'object' && value !== null) {
			traverseObject(value, '.');
		} else if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string' || typeof value === 'undefined' || value === null) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
			// @ts-ignore
			// eslint-disable-next-line no-param-reassign
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

// eslint-disable-next-line no-undef
export { clone, cloneDeep, isEmptyObject, traverse, TraverseProcessor };

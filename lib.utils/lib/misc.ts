import clone from 'lodash.clone';
import cloneDeep from 'lodash.clonedeep';

/**
 * Removes first occurrence of the item from array if exists
 *
 * @param {boolean|number|string}			item
 * @param {Array<boolean|number|string>}	array
 *
 * @return {boolean}
 */
function removeItemFromArray(item: boolean | number | string, array: Array<boolean | number | string>): boolean {
	const indexOfTheItem = array.indexOf(item);
	if (indexOfTheItem !== -1) {
		return array.splice(indexOfTheItem, 1).length === 1;
	}
	return false;
}

function isEmptyObject(obj: object): boolean {
	return Object.entries(obj).length === 0 && obj.constructor === Object;
}

type TraverseProcessor = (value: boolean | number | string) => void | boolean | number | string;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function traverse(object: object, processor: TraverseProcessor, alterDeepClone?: boolean): object {
	if (alterDeepClone) {
		// eslint-disable-next-line no-param-reassign
		object = cloneDeep(object);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function traverseArray(arr: Array<any>): void {
		for (let i = 0; i < arr.length; i++) {
			// eslint-disable-next-line no-use-before-define, @typescript-eslint/no-use-before-define
			continueTraversal(arr, i, arr[i]);
		}
	}

	function traverseObject(obj: object): void {
		const keys = Object.getOwnPropertyNames(obj);
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];
			// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
			// @ts-ignore
			// eslint-disable-next-line no-use-before-define, @typescript-eslint/no-use-before-define
			continueTraversal(obj, key, obj[key]);
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function continueTraversal(currentObject: object | Array<any>, key: string | number, value: any): void {
		if (Array.isArray(value)) {
			traverseArray(value);
		} else if (typeof value === 'object' && value !== null) {
			traverseObject(value);
		} else if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
			const processedVal = processor(value);
			if (processedVal) {
				// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
				// @ts-ignore
				// eslint-disable-next-line no-param-reassign
				currentObject[key] = processedVal;
			}
		}
	}

	traverseObject(object);

	return object;
}

// eslint-disable-next-line no-undef
export { clone, cloneDeep, removeItemFromArray, isEmptyObject, traverse, TraverseProcessor };

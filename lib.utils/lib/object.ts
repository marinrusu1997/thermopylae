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

type TraverseProcessor = (value: boolean | number | string) => void | boolean | number | string;

/**
 * Iterates over a provided object and processes it's leafs using provided processor.
 * If the processor returns a value different from `undefined`, the leaf value will be replaced by this one.
 * If can option for altering of a clone of the provided object.
 *
 * @param object			Object which needs to be iterated.
 * @param processor			Leaf processor
 * @param alterDeepClone	Alter a deep clone instead of the provided object.
 */
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
			if (typeof processedVal !== 'undefined') {
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
export { clone, cloneDeep, isEmptyObject, traverse, TraverseProcessor };

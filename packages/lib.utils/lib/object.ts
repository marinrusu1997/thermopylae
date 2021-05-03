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

/**
 * Traversable value in the object that can be processed.
 */
type TraversableValue = undefined | null | boolean | number | string;

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
	(currentPath: string, value: TraversableValue): TraversableValue;
}

/**
 * Object traversal context.
 *
 * @private
 */
interface TraverseContext {
	processor: TraverseProcessor;
	currentPath: string;
}

/**
 * Iterates over a provided object and processes it's leaves using provided processor.
 * After processing it must return new value or the old one.
 *
 * @template T		Type of the object or array.
 *
 * @param objectOrArray			Object which needs to be iterated.
 * @param processor				Leaf processor
 * @param alterDeepClone		Alter a deep clone instead of the provided object.
 *
 * @returns	Traversed object which might be altered by `processor`.
 */
function traverse<T extends ObjMap | Array<any>>(objectOrArray: T, processor: TraverseProcessor, alterDeepClone?: boolean): T {
	if (alterDeepClone) {
		objectOrArray = cloneDeep(objectOrArray); // @fixme we need to clone deep array too
	}

	const context: TraverseContext = {
		processor,
		currentPath: ''
	};

	if (Array.isArray(objectOrArray)) {
		traverseArray(context, objectOrArray as Array<any>, ''); // when we start, we don't have initial token, so pathSeparator is empty
	} else {
		traverseObject(context, objectOrArray, ''); // when we start, we don't have initial token, so pathSeparator is empty
	}

	return objectOrArray;
}

function continueTraversal(context: TraverseContext, currentObject: ObjMap | Array<any>, key: string | number, value: any): void {
	if (Array.isArray(value)) {
		traverseArray(context, value);
	} else if (typeof value === 'object' && value !== null) {
		traverseObject(context, value);
	} else if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string' || typeof value === 'undefined' || value === null) {
		(currentObject as ObjMap)[key] = context.processor(context.currentPath, value); // trick TS, we can index object with string, and array with number
	}
}

function traverseObject(context: TraverseContext, obj: ObjMap, pathSeparator = '.'): void {
	const keys = Object.getOwnPropertyNames(obj);
	const appendIndex = context.currentPath.length;

	let key: string;
	for (let i = 0; i < keys.length; i++) {
		key = keys[i];

		context.currentPath += `${pathSeparator}${key}`;
		continueTraversal(context, obj, key, obj[key]);
		context.currentPath = context.currentPath.substring(0, appendIndex);
	}
}

function traverseArray(context: TraverseContext, arr: Array<any>, pathSeparator = '.'): void {
	const appendIndex = context.currentPath.length;
	for (let i = 0; i < arr.length; i++) {
		context.currentPath += `${pathSeparator}[${i}]`;
		continueTraversal(context, arr, i, arr[i]);
		context.currentPath = context.currentPath.substring(0, appendIndex);
	}
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
 * @private
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
 * @returns		Flattened object.
 */
function flatten(obj: ObjMap): Nullable<ObjMap> {
	// see https://gist.github.com/penguinboy/762197

	if (obj === null) {
		return null;
	}

	const toReturn: ObjMap = {};

	for (const objKey in obj) {
		if (!Object.prototype.hasOwnProperty.call(obj, objKey)) {
			continue;
		}

		const adjustedObjKey = `${Array.isArray(obj) ? `[${objKey}]` : `${objKey}`}`;

		if (typeof obj[objKey] === 'object') {
			const flatObject = flatten(obj[objKey]);
			if (flatObject === null) {
				toReturn[adjustedObjKey] = flatObject;
			} else {
				for (const flatObjectKey of Object.keys(flatObject)) {
					toReturn[`${adjustedObjKey}.${flatObjectKey}`] = flatObject[flatObjectKey];
				}
			}
		} else {
			toReturn[adjustedObjKey] = obj[objKey];
		}
	}
	return toReturn;
}

export { clone, cloneDeep, isObject, isEmpty, traverse, TraverseProcessor, TraversableValue, sort, flatten };

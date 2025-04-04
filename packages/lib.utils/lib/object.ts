import type { Nullable, ObjMap } from '@thermopylae/core.declarations';
import rfdc from 'rfdc';
import type { Primitive } from 'ts-essentials';
import { objectKeys } from 'tsafe';
import type { Any } from './typings/alias.js';
import type { DeepMutable } from './typings/mutability.js';
import type { Inversed, Underscored } from './typings/object.js';

const safeClone = rfdc() as <T>(obj: T) => DeepMutable<T>;

/**
 * Create a deep copy of the object.
 *
 * @param   obj Object to be cloned.
 *
 * @returns     Deep copy of the object.
 */
function fastClone<T>(obj: T): DeepMutable<T> {
	if (!obj) {
		return obj as DeepMutable<T>;
	}

	if (Array.isArray(obj)) {
		const { length } = obj;
		const arr = new Array(length);
		for (let i = 0; i < length; i++) {
			arr[i] = fastClone(obj[i]);
		}
		return arr as DeepMutable<T>;
	}

	if (typeof obj === 'object') {
		const keys = objectKeys(obj as Record<string, unknown>);
		const { length } = keys;
		const newObject: Record<string, unknown> = {};
		for (let i = 0; i < length; i++) {
			const key = keys[i];
			newObject[key] = fastClone((obj as Record<string, unknown>)[key] as T);
		}
		return newObject as DeepMutable<T>;
	}

	return obj as DeepMutable<T>;
}

/**
 * Verify if `value` is an object.
 *
 * @param   value Value to test for.
 *
 * @returns       Whether value is an object.
 */
function isObject<T>(value: T): boolean {
	return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Verify if object is empty and contains no keys.
 *
 * @template T Object type.
 *
 * @param   object Object to test for.
 *
 * @returns        Whether object is empty.
 */
function isEmpty<T extends object>(object: T): boolean {
	if (object.constructor !== Object) {
		return false;
	}

	for (const property in object) {
		if (Object.hasOwn(object, property)) {
			return false;
		}
	}
	return true;
}

/**
 * Creates a new object with all properties being underscored.
 *
 * @param   object
 *
 * @returns        Underscored object.
 */
function underscoreKeys<T extends ObjMap>(object: T): Underscored<T> {
	const entries = Object.entries(object);
	for (const entry of entries) {
		if (!entry[0].startsWith('_')) {
			entry[0] = `_${entry[0]}`;
		}
	}
	return Object.fromEntries(entries) as Any;
}

/**
 * Inverses keys with values, i.e. from key -> value to value -> key.
 *
 * @param   obj
 *
 * @returns     Inversed object.
 */
function inverse<T extends Record<string, string | number>>(obj: T): Inversed<T> {
	return Object.fromEntries(Object.entries(obj).map(([k, v]) => [v, k])) as Any;
}

/**
 * Processor for object leaves. After processing it must return new value or the old one.
 *
 * @param   currentPath Path to current property in dot notation.
 * @param   value       Value of current property.
 *
 * @returns             Processed value.
 */
type TraverseProcessor = (currentPath: string, value: Primitive) => Primitive;

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
 * Iterates over a provided object and processes it's leaves using provided processor. After
 * processing it must return new value or the old one.
 *
 * @template T Type of the object or array.
 *
 * @param   objectOrArray  Object which needs to be iterated.
 * @param   processor      Leaf processor.
 * @param   alterDeepClone Alter a deep clone instead of the provided object.
 *
 * @returns                Traversed object which might be altered by `processor`.
 */
function traverse<T extends ObjMap | Array<unknown>>(objectOrArray: T, processor: TraverseProcessor, alterDeepClone?: boolean): T {
	if (alterDeepClone) {
		objectOrArray = structuredClone(objectOrArray);
	}

	const context: TraverseContext = {
		processor,
		currentPath: ''
	};

	if (Array.isArray(objectOrArray)) {
		traverseArray(context, objectOrArray as unknown[], ''); // when we start, we don't have initial token, so pathSeparator is empty
	} else {
		traverseObject(context, objectOrArray, ''); // when we start, we don't have initial token, so pathSeparator is empty
	}

	return objectOrArray;
}

function continueTraversal(context: TraverseContext, currentObject: ObjMap | Array<unknown>, key: string | number, value: unknown): void {
	if (Array.isArray(value)) {
		traverseArray(context, value);
	} else if (typeof value === 'object' && value !== null) {
		traverseObject(context, value);
	} else if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string' || value == null) {
		(currentObject as ObjMap)[key] = context.processor(context.currentPath, value); // trick TS, we can index object with string, and array with number
	}
}

function traverseObject(context: TraverseContext, obj: ObjMap, pathSeparator = '.'): void {
	const keys = Object.getOwnPropertyNames(obj);
	const appendIndex = context.currentPath.length;

	for (const key of keys) {
		context.currentPath += `${pathSeparator}${key}`;
		continueTraversal(context, obj, key, obj[key]);
		context.currentPath = context.currentPath.slice(0, appendIndex);
	}
}

function traverseArray(context: TraverseContext, arr: unknown[], pathSeparator = '.'): void {
	const appendIndex = context.currentPath.length;
	for (let i = 0; i < arr.length; i++) {
		context.currentPath += `${pathSeparator}[${i}]`;
		continueTraversal(context, arr, i, arr[i]);
		context.currentPath = context.currentPath.slice(0, appendIndex);
	}
}

/**
 * Deep-sort an object so its attributes are in lexical order.
 *
 * @param   obj       Object to sort.
 * @param   sortArray Whether to sort the arrays inside of the object.
 *
 * @returns           Sorted object.
 */
function sort(obj: ObjMap, sortArray = true): ObjMap {
	return doSortObject(obj, sortArray) as ObjMap;
}
/**
 * @private
 *
 * @param   obj
 * @param   sortArray
 *
 * @returns           Sorted object.
 */
function doSortObject(obj: ObjMap, sortArray = true): ObjMap | Array<unknown> {
	if (!obj) {
		return obj;
	} // do not sort null, false or undefined

	// array
	if (Array.isArray(obj)) {
		return sortArray
			? obj
					.sort((first, second) => {
						if (typeof first === 'string' && typeof second === 'string') {
							return first.localeCompare(second);
						}

						return typeof first === 'object' ? 1 : -1;
					})
					.map((item) => sort(item as ObjMap, sortArray))
			: obj;
	}

	// object
	if (typeof obj === 'object') {
		if (obj instanceof RegExp) {
			return obj;
		}

		const out: ObjMap = {};
		const sortedKeys = Object.keys(obj).sort((first, second) => first.localeCompare(second));
		for (const key of sortedKeys) {
			out[key] = sort(obj[key], sortArray);
		}
		return out;
	}

	// everything else
	return obj;
}

/**
 * Flatten an object, by creating a new one, having all of the nested keys top level.
 *
 * @param   obj Object to be flattened.
 *
 * @returns     Flattened object.
 */
function flatten(obj: ObjMap): Nullable<ObjMap> {
	// see https://gist.github.com/penguinboy/762197

	if (obj === null) {
		return null;
	}

	const toReturn: ObjMap = {};

	for (const objKey in obj) {
		if (!Object.hasOwn(obj, objKey)) {
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

export { isObject, isEmpty, traverse, sort, flatten, fastClone, safeClone, inverse, underscoreKeys };
export type { TraverseProcessor };

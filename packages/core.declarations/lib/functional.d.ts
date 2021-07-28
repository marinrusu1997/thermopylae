import { ComparisonResult } from './enums';

/**
 * Represents an object which can be cloned.
 *
 * @template T 	Type of the object.
 */
export interface Cloneable<T> {
	clone(): T;
}

/**
 * Represents an object which can be compared with another one.
 *
 * @template T 	Type of the object.
 */
export interface Comparable<T> {
	compare(other: T): ComparisonResult;
}

/**
 * Represents an object which can be compared for equality with another one.
 *
 * @template T 	Type of the object.
 */
export interface Same<T> {
	equals(other: T): boolean;
}

/**
 * Represents an object which can be uniquely identified by it's hash code.
 */
export interface Identity {
	hashCode(): string;
}

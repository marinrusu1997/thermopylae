import type { ComparisonResult } from './enums.js';

/**
 * Represents an object which can be cloned.
 *
 * @template T Type of the object.
 */
interface Cloneable<T> {
	clone(): T;
}

/**
 * Represents an object which can be compared with another one.
 *
 * @template T Type of the object.
 */
interface Comparable<T> {
	compare(other: T): ComparisonResult;
}

/**
 * Represents an object which can be compared for equality with another one.
 *
 * @template T Type of the object.
 */
interface Same<T> {
	equals(other: T): boolean;
}

/** Represents an object which can be uniquely identified by it's hash code. */
interface Identity {
	hashCode(): string;
}

export type { Cloneable, Comparable, Same, Identity };

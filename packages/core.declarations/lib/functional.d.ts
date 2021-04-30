import { ComparisonResult } from './enums';

export interface Cloneable<T> {
	clone(): T;
}

export interface Comparable<T> {
	compare(other: T): ComparisonResult;
}

export interface Same<T> {
	equals(other: T): boolean;
}

export interface Identity {
	hashCode(): string;
}

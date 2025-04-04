// oxlint-disable no-explicit-any
import type { ComparisonResult } from './enums.js';

type Processor<T> = (entry: T) => void;
type Runnable = () => void;

type SyncFunction<I = any, O = any> = (...args: I[]) => O;
type AsyncFunction<I = any, O = any> = (...args: I[]) => Promise<O>;

type UnaryPredicate<T> = (val: T) => boolean;
type UnaryPredicateAsync<T> = (val: T) => Promise<boolean>;
type BinaryPredicate<T, V> = (first: T, second: V) => boolean;
type BinaryPredicateAsync<T, V> = (first: T, second: V) => Promise<boolean>;

type Mapper<T, U = T> = (val: T) => U;
type AsyncMapper<T, U = T> = (val: T) => Promise<U>;

type Equals<T> = (first: T, second: T) => boolean;
type Comparator<T> = (first: T, second: T) => ComparisonResult;

type PromiseResolve<T> = (value: T | PromiseLike<T>) => void;
type PromiseReject = (reason?: any) => void;

export type {
	Processor,
	Runnable,
	SyncFunction,
	AsyncFunction,
	UnaryPredicate,
	UnaryPredicateAsync,
	BinaryPredicate,
	BinaryPredicateAsync,
	Mapper,
	AsyncMapper,
	Equals,
	Comparator,
	PromiseResolve,
	PromiseReject
};

import type { ComparisonResult } from './enums.js';

export type Processor<T> = (entry: T) => void;
export type Runnable = () => void;

export type SyncFunction<I = any, O = any> = (...args: Array<I>) => O;
export type AsyncFunction<I = any, O = any> = (...args: Array<I>) => Promise<O>;

export type UnaryPredicate<T> = (val: T) => boolean;
export type UnaryPredicateAsync<T> = (val: T) => Promise<boolean>;
export type BinaryPredicate<T, V> = (first: T, second: V) => boolean;
export type BinaryPredicateAsync<T, V> = (first: T, second: V) => Promise<boolean>;

export type Mapper<T, U = T> = (val: T) => U;
export type AsyncMapper<T, U = T> = (val: T) => Promise<U>;

export type Equals<T> = (first: T, second: T) => boolean;
export type Comparator<T> = (first: T, second: T) => ComparisonResult;

export type PromiseResolve<T> = (value: T | PromiseLike<T>) => void;
export type PromiseReject = (reason?: any) => void;

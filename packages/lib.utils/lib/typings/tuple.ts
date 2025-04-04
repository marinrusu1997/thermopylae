import type { IsTuple } from 'ts-essentials';
import type { Any } from './alias.js';

type SubTuples<T extends readonly unknown[]> = T extends [infer F, ...infer R] ? (R extends unknown[] ? SubTuples<R> | [F, ...SubTuples<R>] : [F]) : [];
type AllSubTuples<T extends readonly unknown[]> = SubTuples<T> | [];

type OrderedSubTuples<T extends readonly unknown[]> = T extends [infer F, ...infer R] ? [F] | [F, ...OrderedSubTuples<R>] : [];
type AllOrderedSubTuples<T extends readonly unknown[]> = IsTuple<T> extends never ? T : OrderedSubTuples<T> | [];

type OrderedOptionalSubTuples<T extends readonly unknown[]> = T extends [infer F, ...infer R] ? [F?] | [F?, ...OrderedSubTuples<R>] : [];
type AllOrderedOptionalSubTuples<T extends readonly unknown[]> = OrderedOptionalSubTuples<T> | [];

type IsUnion<T, U = T> = T extends Any
	? [U] extends [T] // If `T` is not a union, `[U] extends [T]` will be true
		? false
		: true
	: never;

export type { SubTuples, AllSubTuples, OrderedSubTuples, AllOrderedSubTuples, OrderedOptionalSubTuples, AllOrderedOptionalSubTuples, IsUnion };

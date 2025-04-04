import type { AnyArray } from 'ts-essentials';
import type { Any } from './alias.js';

type Shift<T extends AnyArray> = ((...items: T) => Any) extends (first: Any, ...rest: infer Rest) => Any ? Rest : never;

type ShiftUnion<P extends PropertyKey, T extends AnyArray> = T extends AnyArray ? (T[0] extends P ? Shift<T> : never) : never;

// https://stackoverflow.com/a/57837897
type DeepRequiredSome<T, P extends string[]> = T extends object
	? Omit<T, Extract<keyof T, P[0]>> &
			Required<{
				[K in Extract<keyof T, P[0]>]: NonNullable<DeepRequiredSome<T[K], ShiftUnion<K, P>>>;
			}>
	: T;

export type { DeepRequiredSome };

import type { DeepReadonly } from 'ts-essentials';
import { deepFreeze } from '../deep-freeze.js';
import type { Any } from './alias.js';

type Invalid<T> = Error & { errorMessage: T };

type AsUniqueArray<A extends readonly Any[], B extends readonly Any[]> = {
	[I in keyof A]: unknown extends {
		[J in keyof B]: J extends I ? never : B[J] extends A[I] ? unknown : never;
	}[number]
		? Invalid<[A[I], 'is repeated']>
		: A[I];
};

type Narrowable = string | number | boolean | object | null | undefined | symbol;

// https://stackoverflow.com/a/57021889
const enumeration = <N extends Narrowable, A extends [] | (readonly N[] & AsUniqueArray<A, A>)>(arr: A): DeepReadonly<A> => deepFreeze(arr);

export { enumeration };

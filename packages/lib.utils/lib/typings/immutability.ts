import type { DeepReadonly, Prettify } from 'ts-essentials';

type ReadonlyWithInDepthRoots<T extends object, Roots extends keyof T> = Prettify<
	{ readonly [K in Exclude<keyof T, Roots>]: T[K] } & {
		readonly [K in Roots]: DeepReadonly<T[K]>;
	}
>;

export type { ReadonlyWithInDepthRoots };

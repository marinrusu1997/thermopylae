import type { DeepReadonly } from 'ts-essentials';
import { deepFreeze } from '../deep-freeze.js';
import type { Any } from './alias.js';

// https://stackoverflow.com/a/55266531, https://github.com/microsoft/TypeScript/issues/53171

const exhaustive =
	<T extends string>() =>
	<L extends [T, ...T[]]>(
		...items: L extends Any ? (Exclude<T, L[number]> extends never ? L : Exclude<T, L[number]>[]) : never
	): DeepReadonly<typeof items> =>
		deepFreeze(items);

export { exhaustive };

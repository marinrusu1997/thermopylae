import { array } from '@thermopylae/lib.utils';
import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { ExpirableCacheKeyedEntry, EXPIRES_AT_SYM } from '../../../lib/policies/expiration/abstract';
import { SetOperationContext } from '../../../lib/contracts/replacement-policy';

function generateEntry<K>(key: K): ExpirableCacheKeyedEntry<K, any> {
	return {
		key,
		value: array.randomElement(generateEntry.VALUES),
		[EXPIRES_AT_SYM]: 0
	};
}
generateEntry.VALUES = [undefined, null, false, 0, '', {}, []];

function generateSetContext(expiresAfter?: Seconds | null, expiresFrom?: UnixTimestamp): SetOperationContext {
	// @ts-expect-error
	return { totalEntriesNo: 0, expiresAfter, expiresFrom };
}

export { generateEntry, generateSetContext };

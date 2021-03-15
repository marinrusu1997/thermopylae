import { array } from '@thermopylae/lib.utils';
import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { EXPIRES_AT_SYM } from '../../../lib/policies/expiration/abstract';
import { SetOperationContext } from '../../../lib/contracts/replacement-policy';
import { ExpirableCacheKeyedEntryHeapNode } from '../../../lib/policies/expiration/proactive';
import { HEAP_NODE_IDX_SYM } from '../../../lib/helpers/heap';

function generateEntry<K>(key: K): ExpirableCacheKeyedEntryHeapNode<K, any> {
	return {
		key,
		value: array.randomElement(generateEntry.VALUES),
		[EXPIRES_AT_SYM]: 0,
		[HEAP_NODE_IDX_SYM]: undefined! // it does need to be here initially when entry is created
	};
}
generateEntry.VALUES = [undefined, null, false, 0, '', {}, []];

function generateSetContext(expiresAfter?: Seconds | null, expiresFrom?: UnixTimestamp): SetOperationContext {
	// @ts-expect-error
	return { totalEntriesNo: 0, expiresAfter, expiresFrom };
}

export { generateEntry, generateSetContext };

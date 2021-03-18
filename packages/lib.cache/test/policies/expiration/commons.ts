import { array } from '@thermopylae/lib.utils';
import { EXPIRES_AT_SYM } from '../../../lib/policies/expiration/abstract';
import { ExpirableCacheKeyedEntryHeapNode } from '../../../lib/policies/expiration/proactive';
import { HEAP_NODE_IDX_SYM } from '../../../lib/data-structures/heap';

function generateEntry<K>(key: K): ExpirableCacheKeyedEntryHeapNode<K, any> {
	return {
		key,
		value: array.randomElement(generateEntry.VALUES),
		[EXPIRES_AT_SYM]: 0,
		[HEAP_NODE_IDX_SYM]: undefined! // it does need to be here initially when entry is created
	};
}
generateEntry.VALUES = [undefined, null, false, 0, '', {}, []];

export { generateEntry };

import {
	type AbsoluteExpirationPolicyArgumentsBundle,
	EntryPoolCacheBackend,
	HeapGarbageCollector,
	PolicyBasedCache,
	ProactiveExpirationPolicy
} from '@thermopylae/lib.cache';
import type { types } from '@thermopylae/lib.utils';

const MemoryCache = new PolicyBasedCache<string, types.Any, AbsoluteExpirationPolicyArgumentsBundle>(new EntryPoolCacheBackend<string, types.Any>(), [
	new ProactiveExpirationPolicy<string, types.Any>(new HeapGarbageCollector())
]);

export { MemoryCache };

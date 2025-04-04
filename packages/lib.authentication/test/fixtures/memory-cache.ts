import {
	type AbsoluteExpirationPolicyArgumentsBundle,
	EntryPoolCacheBackend,
	HeapGarbageCollector,
	PolicyBasedCache,
	ProactiveExpirationPolicy
} from '@thermopylae/lib.cache';

const MemoryCache = new PolicyBasedCache<string, any, AbsoluteExpirationPolicyArgumentsBundle>(new EntryPoolCacheBackend<string, any>(), [
	new ProactiveExpirationPolicy<string, any>(new HeapGarbageCollector())
]);

export { MemoryCache };

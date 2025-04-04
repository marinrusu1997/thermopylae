export { EntryPoolCacheBackend } from './backend/entry-pool.js';
export { EsMapCacheBackend } from './backend/es-map.js';

export { PolicyBasedCache } from './caches/policy-based.js';
export { PolicyPerKeyCache, type PolicyPerKeyCacheArgumentsBundle } from './caches/policy-per-key.js';
export { RenewableCache, type KeyRetriever, type KeyConfigProvider } from './caches/renewable.js';

export { type Cache, CacheEvent, type CacheEventListener } from './contracts/cache.js';
export type { CacheBackend, CacheBackendElementsCount, IterableCacheBackend, ReadonlyCacheBackend } from './contracts/cache-backend.js';
export { type CacheReplacementPolicy, type Deleter as CacheEntryDeleter, EntryValidity } from './contracts/cache-replacement-policy.js';

export type { GarbageCollector, ExpirableEntry, EntryExpiredCallback } from './garbage-collectors/interface.js';
export { BucketGarbageCollector } from './garbage-collectors/bucket-gc.js';
export { HeapGarbageCollector } from './garbage-collectors/heap-gc.js';
export { IntervalGarbageCollector, type IntervalGarbageCollectorOptions } from './garbage-collectors/interval-gc.js';

export { ArcEvictionPolicy } from './policies/eviction/arc.js';
export { KeysDependenciesEvictionPolicy, type KeysDependenciesEvictionPolicyArgumentsBundle } from './policies/eviction/dependencies.js';
export { GDSFEvictionPolicy } from './policies/eviction/gdsf.js';
export { LFUEvictionPolicy } from './policies/eviction/lfu.js';
export { LFUDAEvictionPolicy } from './policies/eviction/lfuda.js';
export { LRUEvictionPolicy } from './policies/eviction/lru.js';
export { PriorityEvictionPolicy, type PriorityEvictionPolicyOptions, CacheEntryPriority } from './policies/eviction/priority.js';
export { SegmentedLRUEvictionPolicy } from './policies/eviction/segmented-lru.js';

export { type AbsoluteExpirationPolicyArgumentsBundle } from './policies/expiration/absolute.js';
export { ProactiveExpirationPolicy } from './policies/expiration/proactive.js';
export { ReactiveExpirationPolicy } from './policies/expiration/reactive.js';
export { SlidingProactiveExpirationPolicy, type SlidingExpirationPolicyArgsBundle } from './policies/expiration/sliding.js';
export {
	SlidingReactiveExpirationPolicy,
	type SlidingExpirationPolicyArgsBundle as SlidingReactiveExpirationPolicyArgsBundle
} from './policies/expiration/sliding-reactive.js';

export { INFINITE_EXPIRATION } from './constants.js';
export { ErrorCodes } from './error.js';

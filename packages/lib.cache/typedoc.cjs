const typedoc = require('@thermopylae/dev.environment').configs.typedoc;

typedoc.externalPattern = [
    'lib/data-structures/**/*',
    'lib/error.ts'
];

typedoc.outline = [
    {
        "Backends": {
            "Interface": "contracts_cache_backend",
            "EntryPoolCacheBackend": "backend_entry_pool",
            "EsMapCacheBackend": "backend_es_map"
        },
        "Caches": {
            "Interface": "contracts_cache",
            "PolicyBasedCache": "caches_policy_based",
            "PolicyPerKeyCache": "caches_policy_per_key",
            "RenewableCache": "caches_renewable"
        },
        "Garbage Collectors": {
            "Interface": "garbage_collectors_interface",
            "BucketGarbageCollector": "garbage_collectors_bucket_gc",
            "HeapGarbageCollector": "garbage_collectors_heap_gc",
            "IntervalGarbageCollector": "garbage_collectors_interval_gc"
        },
        "Replacement Policies": {
            "Interface": "contracts_cache_replacement_policy",
            "Expiration": {
                "ProactiveExpirationPolicy": "policies_expiration_proactive",
                "ReactiveExpirationPolicy": "policies_expiration_reactive",
                "SlidingProactiveExpirationPolicy": "policies_expiration_sliding",
                "SlidingReactiveExpirationPolicy": "policies_expiration_sliding_reactive"
            },
            "Eviction": {
                "ArcEvictionPolicy": "policies_eviction_arc",
                "GDSFEvictionPolicy": "policies_eviction_gdsf",
                "KeysDependenciesEvictionPolicy": "policies_eviction_dependencies",
                "LFUEvictionPolicy": "policies_eviction_lfu",
                "LFUDAEvictionPolicy": "policies_eviction_lfuda",
                "LRUEvictionPolicy": "policies_eviction_lru",
                "PriorityEvictionPolicy": "policies_eviction_priority",
                "SegmentedLRUEvictionPolicy": "policies_eviction_segmented_lru"
            }
        },
        "Constants": "constants"
    }
];

typedoc.links = [
    {
        "label": "Thermopylae",
        "url": "https://marinrusu1997.github.io/thermopylae"
    },
    {
        "label": "Github",
        "url": "https://github.com/marinrusu1997/thermopylae/tree/master/packages/lib.cache"
    }
];

module.exports = typedoc;

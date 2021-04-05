const typedoc = require('@thermopylae/module-builder').configs.typedoc;
typedoc.externalPattern = [
    'lib/data-structures/**/*',
    'lib/error.ts'
];
typedoc.outline = [
    {
        "Backends": {
            "Interface": "_contracts_cache_backend_d_",
            "EntryPoolCacheBackend": "_backend_entry_pool_",
            "EsMapCacheBackend": "_backend_es_map_"
        },
        "Caches": {
            "Interface": "_contracts_cache_d_",
            "PolicyBasedCache": "_caches_policy_based_",
            "PolicyPerKeyCache": "_caches_policy_per_key_",
            "RenewableCache": "_caches_renewable_"
        },
        "Garbage Collectors": {
            "Interface": "_garbage_collectors_interface_d_",
            "BucketGarbageCollector": "_garbage_collectors_bucket_gc_",
            "HeapGarbageCollector": "_garbage_collectors_heap_gc_",
            "IntervalGarbageCollector": "_garbage_collectors_interval_gc_"
        },
        "Replacement Policies": {
            "Interface": "_contracts_cache_replacement_policy_d_",
            "Expiration": {
                "ProactiveExpirationPolicy": "_policies_expiration_proactive_",
                "ReactiveExpirationPolicy": "_policies_expiration_reactive_",
                "SlidingProactiveExpirationPolicy": "_policies_expiration_sliding_",
                "SlidingReactiveExpirationPolicy": "_policies_expiration_sliding_reactive_"
            },
            "Eviction": {
                "GDSFEvictionPolicy": "_policies_eviction_gdsf_",
                "KeysDependenciesEvictionPolicy": "_policies_eviction_dependencies_",
                "LFUEvictionPolicy": "_policies_eviction_lfu_",
                "LFUDAEvictionPolicy": "_policies_eviction_lfuda_",
                "LRUEvictionPolicy": "_policies_eviction_lru_",
                "PriorityEvictionPolicy": "_policies_eviction_priority_",
                "SegmentedLRUEvictionPolicy": "_policies_eviction_segmented_lru_"
            }
        },
        "Constants": "_constants_"
    }
];
typedoc.links = [{
    "label": "Bitbucket",
    "url": "https://bitbucket.org/marinrusu1997/framework/src/master/packages/lib.cache/"
}]

module.exports = typedoc;

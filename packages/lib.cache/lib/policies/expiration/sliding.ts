import { CacheReplacementPolicy } from '../../contracts/replacement-policy';
import { CacheEntry, CacheKey } from '../../contracts/commons';

interface ExpirableCacheEntry<Key, Value> extends CacheKey<Key>, CacheEntry<Value> {}

class SlidingReactiveExpirationPolicy<Key, Value, ArgumentsBundle> implements CacheReplacementPolicy<Key, Value, ArgumentsBundle> {}

export { SlidingReactiveExpirationPolicy };

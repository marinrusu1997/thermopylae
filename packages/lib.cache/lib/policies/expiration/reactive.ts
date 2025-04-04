import { AbsoluteExpirationPolicy, type AbsoluteExpirationPolicyArgumentsBundle } from './absolute.js';

/**
 * Expiration policy which evicts keys when they are requested. <br/> When {@link Cache.get}
 * operation is performed, policy will check if key it's expired and if so, will evict it from
 * cache, returning `undefined` to clients. <br/> This kind of policy can be used if you have keys
 * that will be often queried, so the cache won't be polluted with expired entries that weren't
 * queried for long time. To solve the latest problem, you can use an additional LRU/LFU policy.
 *
 * @template Key Type of the key.
 * @template Value Type of the value.
 * @template ArgumentsBundle Type of the arguments bundle.
 */
class ReactiveExpirationPolicy<
	Key,
	Value,
	ArgumentsBundle extends AbsoluteExpirationPolicyArgumentsBundle = AbsoluteExpirationPolicyArgumentsBundle
> extends AbsoluteExpirationPolicy<Key, Value, ArgumentsBundle> {}

export { ReactiveExpirationPolicy };

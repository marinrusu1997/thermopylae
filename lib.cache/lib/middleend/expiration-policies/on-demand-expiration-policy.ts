import { AbstractExpirationPolicy } from './abstract-expiration-policy';
import { CacheEntry } from '../../contracts/sync/cache-backend';

class OnDemandExpirationPolicy<Key, Value, Entry extends CacheEntry<Value>> extends AbstractExpirationPolicy<Key, Value, Entry> {}

export { OnDemandExpirationPolicy };

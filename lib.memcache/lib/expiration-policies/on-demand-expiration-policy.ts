import { AbstractExpirationPolicy } from './abstract-expiration-policy';

class OnDemandExpirationPolicy<Key = string> extends AbstractExpirationPolicy<Key> {}

export { OnDemandExpirationPolicy };

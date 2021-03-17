import { AbstractExpirationPolicy, AbstractExpirationPolicyArgumentsBundle } from './abstract';

class ReactiveExpirationPolicy<
	Key,
	Value,
	ArgumentsBundle extends AbstractExpirationPolicyArgumentsBundle = AbstractExpirationPolicyArgumentsBundle
> extends AbstractExpirationPolicy<Key, Value, ArgumentsBundle> {}

export { ReactiveExpirationPolicy };

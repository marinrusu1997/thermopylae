import { AbstractExpirationPolicy, AbstractExpirationPolicyArgumentsBundle } from './abstract';

class ReactiveExpirationPolicy<Key, Value, ArgumentsBundle extends AbstractExpirationPolicyArgumentsBundle> extends AbstractExpirationPolicy<
	Key,
	Value,
	ArgumentsBundle
> {}

export { ReactiveExpirationPolicy };

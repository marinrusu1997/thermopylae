import { AbsoluteExpirationPolicy, AbsoluteExpirationPolicyArgumentsBundle } from './absolute';

class ReactiveExpirationPolicy<
	Key,
	Value,
	ArgumentsBundle extends AbsoluteExpirationPolicyArgumentsBundle = AbsoluteExpirationPolicyArgumentsBundle
> extends AbsoluteExpirationPolicy<Key, Value, ArgumentsBundle> {}

export { ReactiveExpirationPolicy };

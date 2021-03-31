import { createException, ErrorCodes } from '../error';
import { INFINITE_EXPIRATION } from '../constants';

type TtlProvider<K> = (key: K) => number;

interface TtlRegistryEntry {
	selector: string | RegExp;
	ttl: number;
}

class TtlRegistry<Key = string> {
	private readonly registry: Array<TtlRegistryEntry> | TtlProvider<Key>;

	constructor(registry: Array<TtlRegistryEntry> | TtlProvider<Key>) {
		this.registry = registry;
	}

	public resolve(key: Key): number {
		if (Array.isArray(this.registry)) {
			if (typeof key !== 'string') {
				throw createException(ErrorCodes.MISCONFIGURATION, `When registry is an array, typeof key must be string. Found ${typeof key}`);
			}

			let i = this.registry.length;
			while (i--) {
				if (typeof this.registry[i].selector === 'string' && this.registry[i].selector === key) {
					return this.registry[i].ttl;
				}
				if (this.registry[i].selector instanceof RegExp && (this.registry[i].selector as RegExp).test(key)) {
					return this.registry[i].ttl;
				}
			}
		} else if (typeof this.registry === 'function') {
			return this.registry(key);
		} else {
			throw createException(ErrorCodes.MISCONFIGURATION, `Registry should be array or function. Found ${typeof this.registry}`);
		}

		return INFINITE_EXPIRATION;
	}

	public static empty<K>(): TtlRegistry<K> {
		return new TtlRegistry<K>(() => INFINITE_EXPIRATION);
	}
}

export { TtlRegistry };

import { BaseCache, BaseCacheConfig } from './base-cache';
import { HighResolutionExpirationPolicy } from '../expiration-policies/high-resolution-expiration-policy';
import { createException, ErrorCodes } from '../error';
import { ExpirableCacheValue } from '../contracts/cache';
import { EvictionPolicy } from '../contracts/eviction-policy';

class AutoExpirableCache<Key = string, Value = any, Entry extends ExpirableCacheValue<Value> = ExpirableCacheValue<Value>> extends BaseCache<
	Key,
	Value,
	Entry
> {
	constructor(config?: Partial<BaseCacheConfig>, evictionPolicy?: EvictionPolicy<Key, Value, Entry>) {
		super(config, new HighResolutionExpirationPolicy<Key>(), evictionPolicy);
	}

	public take(key: Key): Value | undefined {
		throw createException(ErrorCodes.OPERATION_NOT_SUPPORTED, `Taking key ${key} will remove element. Deletion is not supported. `);
	}

	public del(key: Key): boolean {
		throw createException(ErrorCodes.OPERATION_NOT_SUPPORTED, `Attempt to delete key ${key}. Deletion is not supported. `);
	}

	public mdel(keys: Array<Key>): void {
		throw createException(ErrorCodes.OPERATION_NOT_SUPPORTED, `Attempt to delete keys ${keys.join(', ')}. Deletion is not supported. `);
	}
}

export { AutoExpirableCache };

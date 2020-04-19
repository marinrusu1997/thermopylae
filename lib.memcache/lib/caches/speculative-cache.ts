import { Seconds } from '@thermopylae/core.declarations';
import {BaseCacheConfig, Cache, CachedItem, CacheStats, EventType} from '../cache';

interface SpeculativeCacheConfig extends BaseCacheConfig {
	checkInterval: Seconds;

}

class SpeculativeCache<Key = string, Value = any> implements Cache<Key, Value> {
	clear(): void {}

	del(key: Key): boolean {
		return false;
	}

	get(key: Key): Value | undefined {
		return undefined;
	}

	getTtl(key: Key): Seconds | undefined {
		return undefined;
	}

	has(key: Key): boolean {
		return false;
	}

	keys(): Array<Key> {
		return undefined;
	}

	mdel(keys: Array<Key>): void {}

	mget(keys: Array<Key>): Array<CachedItem<Key, Value>> {
		return undefined;
	}

	on(event: EventType, listener: EventListener<Key, Value>): this {
		return undefined;
	}

	set(key: Key, value: Value, ttl: Seconds): this {
		return undefined;
	}

	stats(): CacheStats {
		return undefined;
	}

	take(key: Key): Value | undefined {
		return undefined;
	}

	ttl(key: Key, ttl?: Seconds): this {
		return undefined;
	}

	upset(key: Key, value: Value, ttl: Seconds): this {
		return undefined;
	}
}

export { SpeculativeCache };

import { AsyncCacheFrontend } from '../../contracts/async/async-cache-frontend';
import { MemCache } from '../sync/mem-cache';
import { CacheFrontend } from '../../contracts/sync/cache-frontend';
import { CacheEntry } from '../../contracts/sync/cache-backend';

type Retriever<K, V> = (key: K) => Promise<V>;

interface RenewableCacheOptions<K, V> {
	retriever: Retriever<K, V>;
	cache?: CacheFrontend<K, V>;
}

class RenewableCache<Key = string, Value = any, Entry extends CacheEntry<Value> = CacheEntry<Value>> implements AsyncCacheFrontend<Key, Value> {
	private readonly cache: CacheFrontend<Key, Value>;

	private readonly retriever: Retriever<Key, Value>;

	constructor(opts: RenewableCacheOptions<Key, Value>) {
		this.cache = opts.cache ?? new MemCache<Key, Value, Entry>();
		this.retriever = opts.retriever;
	}

	readonly size: number;

	clear(): Promise<void> {
		return Promise.resolve(undefined);
	}

	del(key: Key): Promise<boolean> {
		return Promise.resolve(false);
	}

	empty(): boolean {
		return false;
	}

	get(key: Key): Promise<Value | undefined> {
		return Promise.resolve(undefined);
	}

	has(key: Key): boolean {
		return false;
	}

	keys(): Array<Key> {
		return undefined;
	}

	mdel(keys: Array<Key>): Promise<void> {
		return Promise.resolve(undefined);
	}

	mget(keys: Array<Key>): Promise<Array<CachedItem<Key, Value>>> {
		return Promise.resolve(undefined);
	}

	on(event: EventType, listener: EventListener<Key, Value>): this {
		return undefined;
	}

	set(key: Key, value: Value, ttl?: Seconds, from?: UnixTimestamp): Promise<void> {
		return Promise.resolve(undefined);
	}

	stats(): CacheStats {
		return undefined;
	}

	take(key: Key): Promise<Value | undefined> {
		return Promise.resolve(undefined);
	}

	ttl(key: Key, ttl: Seconds, from?: UnixTimestamp): boolean {
		return false;
	}

	upset(key: Key, value: Value, ttl?: Seconds, from?: UnixTimestamp): Promise<void> {
		return Promise.resolve(undefined);
	}
}

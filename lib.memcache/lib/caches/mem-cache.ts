import { Seconds, Milliseconds } from '@thermopylae/core.declarations';
import { object } from '@thermopylae/lib.utils';
import { CachedItem, CacheStats, EventType, EventListener, INFINITE_TTL } from '../cache';
import { AbstractCache, BaseCacheEntry } from './abstract-cache';

const { isObject, cloneDeep } = object;

const now = (): Milliseconds => new Date().getTime();

class MemCache<Key = string, Value = any> extends AbstractCache<Key, Value> {
	public set(key: Key, value: Value, ttl?: Seconds): this {
		this.guardMaxKeysNumber();

		this.cache.set(key, this.cacheEntry(value, ttl));
		this.emit('set', key, value);

		return this;
	}

	public upset(key: Key, value: Value, ttl?: Seconds): this {
		const entry = this.internalGet(key);

		if (entry !== undefined) {
			entry.value = this.storedValue(value);
			this.updateTtl(entry, ttl);

			this.cache.set(key, entry);
			this.emit('update', key, value);

			return this;
		}

		return this.set(key, value, ttl);
	}

	public get(key: Key): Value | undefined {
		const entry = this.internalGet(key);
		return entry !== undefined ? entry.value : entry;
	}

	public mget(keys: Array<Key>): Array<CachedItem<Key, Value>> {
		const items: Array<CachedItem<Key, Value>> = [];

		let value;
		// eslint-disable-next-line no-restricted-syntax
		for (const key of keys) {
			value = this.get(key);
			if (value !== undefined) {
				items.push({ key, value });
			}
		}

		return items;
	}

	public take(key: Key): Value | undefined {
		const value = this.internalGet(key);
		if (value === undefined) {
			return value;
		}

		this.del(key);

		return value.value;
	}

	public getTtl(key: Key): Seconds | undefined {
		const entry = this.internalGet(key);
		if (entry === undefined) {
			return entry;
		}
		return this.unStoredTtl(entry.ttl);
	}

	public ttl(key: Key, ttl?: Seconds): boolean {
		const entry = this.internalGet(key);
		if (entry === undefined) {
			return false;
		}

		this.updateTtl(entry, ttl);

		return true;
	}

	public has(key: Key): boolean {
		return this.internalGet(key) !== undefined;
	}

	public del(key: Key): boolean {
		if (this.cache.delete(key)) {
			this.emit('del', key);
			return true;
		}
		return false;
	}

	public mdel(keys: Array<Key>): void {
		// eslint-disable-next-line no-restricted-syntax
		for (const key of keys) {
			this.del(key);
		}
	}

	public keys(): Array<Key> {
		return Array.from(this.cache.keys());
	}

	public stats(): CacheStats {
		return cloneDeep(this.cacheStats);
	}

	public clear(): void {
		this.cache.clear();
		this.resetStats();
		this.emit('flush');
	}

	public on(event: EventType, listener: EventListener<Key, Value>): this {
		return super.on(event, listener);
	}

	private internalGet(key: Key): BaseCacheEntry<Value> | undefined {
		const entry = this.cache.get(key);

		if (entry === undefined) {
			this.cacheStats.misses += 1;
			return entry;
		}

		if (this.expired(entry)) {
			this.cache.delete(key);
			this.emit('expired', key);

			return undefined;
		}

		this.cacheStats.hits += 1;
		return entry;
	}

	private resetStats(): void {
		this.cacheStats.hits = 0;
		this.cacheStats.misses = 0;
	}

	private unStoredTtl(ttl: Milliseconds): Seconds {
		return ttl / 1000;
	}

	private storedTtl(ttl?: Seconds): Milliseconds {
		return (ttl || INFINITE_TTL) * 1000;
	}

	private storedValue(value: Value): Value {
		return this.config.useClones && isObject(value) ? cloneDeep(value) : value;
	}

	private cacheEntry(value: Value, ttl?: Seconds): BaseCacheEntry<Value> {
		ttl = this.storedTtl(ttl);
		return {
			value: this.storedValue(value),
			ttl,
			expires: ttl !== INFINITE_TTL ? now() + ttl : null
		};
	}

	private updateTtl(entry: BaseCacheEntry<Value>, ttl?: Seconds): void {
		ttl = ttl || INFINITE_TTL;
		if (this.unStoredTtl(entry.ttl) !== ttl) {
			ttl = this.storedTtl(ttl);

			const setAt = this.setAt(entry);

			entry.ttl = ttl;
			entry.expires = ttl !== INFINITE_TTL ? (setAt || now()) + ttl : null;
		}
	}

	private setAt(entry: BaseCacheEntry<Value>): Milliseconds | null {
		return entry.expires !== null ? entry.expires - entry.ttl : null;
	}

	private expired(entry: BaseCacheEntry<Value>): boolean {
		return entry.expires !== null ? entry.expires >= now() : false;
	}
}

export { MemCache };

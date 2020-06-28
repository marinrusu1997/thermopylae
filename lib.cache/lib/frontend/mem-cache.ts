import { EventEmitter } from 'events';
import { Label, Seconds, Undefinable, UnixTimestamp } from '@thermopylae/core.declarations';
import { object } from '@thermopylae/lib.utils';
import { INFINITE_KEYS, NOT_FOUND_VALUE } from '../constants';
import { CacheFrontend, EventListener, EventType } from '../contracts/sync/cache-frontend';
import { NoExpirationPolicy } from '../middleend/expiration-policies';
import { NoEvictionPolicy } from '../middleend/eviction-policies/no-eviction-policy';
import { TtlRegistry } from '../helpers/ttl-registry';
import { EsMapBackend } from '../backend/es-map-backend';
import { PolicyMiddleEnd } from '../middleend/policy-middleend';
import { CacheMiddleEnd, CacheStats } from '../contracts/sync/cache-middleend';

interface MemCacheOptions<Key, Value> {
	useClones: boolean;
	ttlRegistry: TtlRegistry<Key>;
	middleend: CacheMiddleEnd<Key, Value>;
}

class MemCache<Key = string, Value = any> extends EventEmitter implements CacheFrontend<Key, Value> {
	protected readonly config: MemCacheOptions<Key, Value>;

	constructor(options?: Partial<MemCacheOptions<Key, Value>>) {
		super();
		this.config = MemCache.fillWithDefaults(options);
	}

	public get name(): Label {
		return MemCache.name;
	}

	/**
	 * @deprecated use this function when you know that key does not exist in cache 100%
	 */
	public set(key: Key, value: Value, ttl?: Seconds, expiresFrom?: UnixTimestamp): this {
		return this.internalSet(key, value, ttl, expiresFrom, true);
	}

	public upset(key: Key, value: Value, ttl?: Seconds, expiresFrom?: UnixTimestamp): this {
		value = this.config.useClones ? object.cloneDeep(value) : value;

		if (this.config.middleend.replace(key, value, ttl, expiresFrom)) {
			this.emit('update', key, value);
			return this;
		}

		return this.internalSet(key, value, ttl, expiresFrom, false);
	}

	public get(key: Key): Undefinable<Value> {
		return this.config.middleend.get(key);
	}

	public mget(keys: Array<Key>): Map<Key, Value> {
		const items = new Map<Key, Value>();

		for (const key of keys) {
			items.set(key, this.config.middleend.get(key));
		}

		return items;
	}

	public take(key: Key): Undefinable<Value> {
		const value = this.config.middleend.get(key);
		if (value === NOT_FOUND_VALUE) {
			return value;
		}

		this.del(key);

		return value;
	}

	public ttl(key: Key, ttl: Seconds, expiresFrom?: UnixTimestamp): boolean {
		return this.config.middleend.ttl(key, ttl, expiresFrom);
	}

	public has(key: Key): boolean {
		return this.config.middleend.get(key) !== NOT_FOUND_VALUE;
	}

	public del(key: Key): boolean {
		const deleted = this.config.middleend.del(key);
		if (deleted) {
			this.emit('del', key);
		}
		return deleted;
	}

	public mdel(keys: Array<Key>): void {
		// eslint-disable-next-line no-restricted-syntax
		for (const key of keys) {
			this.del(key);
		}
	}

	public keys(): Array<Key> {
		return this.config.middleend.keys();
	}

	public get stats(): CacheStats {
		return object.cloneDeep(this.config.middleend.stats);
	}

	public get size(): number {
		return this.config.middleend.size;
	}

	public get empty(): boolean {
		return this.size !== 0;
	}

	public clear(): void {
		this.config.middleend.clear();
		this.emit('flush');
	}

	public on(event: EventType, listener: EventListener<Key, Value>): this {
		return super.on(event, listener);
	}

	private internalSet(key: Key, value: Value, ttl?: number, expiresFrom?: number, withCloning = true) {
		value = withCloning && this.config.useClones ? object.cloneDeep(value) : value;
		ttl = ttl ?? this.config.ttlRegistry.resolve(key);

		this.config.middleend.set(key, value, ttl, expiresFrom);
		this.emit('set', key, value);

		return this;
	}

	private static fillWithDefaults<K, V>(options?: Partial<MemCacheOptions<K, V>>): MemCacheOptions<K, V> {
		options = options || {};
		options.useClones = options.useClones || false;
		options.middleend = options.middleend || new PolicyMiddleEnd<K, V>(new EsMapBackend(), new NoExpirationPolicy(), new NoEvictionPolicy(INFINITE_KEYS));
		options.ttlRegistry = options.ttlRegistry || TtlRegistry.empty<K>();
		return options as MemCacheOptions<K, V>;
	}
}

export { MemCache, MemCacheOptions };

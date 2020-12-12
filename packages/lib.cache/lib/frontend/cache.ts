import { EventEmitter } from 'events';
import { Label, Seconds, Undefinable, UnixTimestamp } from '@thermopylae/core.declarations';
import { object } from '@thermopylae/lib.utils';
import { NOT_FOUND_VALUE } from '../constants';
import { CacheFrontend } from '../contracts/cache-frontend';
import { TtlRegistry } from '../helpers/ttl-registry';
import { EsMapBackend } from '../backend/es-map-backend';
import { CacheMiddleEnd } from '../contracts/cache-middleend';
import { OpaqueMiddleEnd } from '../middleend/opaque-middleend';
import { EventListener, EventType, CacheStats } from '../contracts/commons';

interface MemCacheOptions<Key, Value> {
	useClones: boolean;
	ttlRegistry: TtlRegistry<Key>;
	middleEnd: CacheMiddleEnd<Key, Value>;
}

class Cache<Key = string, Value = any> extends EventEmitter implements CacheFrontend<Key, Value> {
	protected readonly config: MemCacheOptions<Key, Value>;

	constructor(options?: Partial<MemCacheOptions<Key, Value>>) {
		super();
		this.config = Cache.fillWithDefaults(options);
	}

	public get name(): Label {
		return Cache.name;
	}

	/**
	 * @deprecated use this function when you know that key does not exist in cache 100%
	 */
	public set(key: Key, value: Value, ttl?: Seconds, expiresFrom?: UnixTimestamp): this {
		return this.internalSet(key, value, ttl, expiresFrom, true);
	}

	public upset(key: Key, value: Value, ttl?: Seconds, expiresFrom?: UnixTimestamp): this {
		value = this.config.useClones ? object.cloneDeep(value) : value;

		if (this.config.middleEnd.replace(key, value, ttl, expiresFrom)) {
			this.emit('update', key, value);
			return this;
		}

		return this.internalSet(key, value, ttl, expiresFrom, false);
	}

	public get(key: Key): Undefinable<Value> {
		return this.config.middleEnd.get(key);
	}

	public mget(keys: Array<Key>): Map<Key, Undefinable<Value>> {
		const items = new Map<Key, Undefinable<Value>>();

		for (const key of keys) {
			items.set(key, this.config.middleEnd.get(key));
		}

		return items;
	}

	public take(key: Key): Undefinable<Value> {
		const value = this.config.middleEnd.get(key);
		if (value === NOT_FOUND_VALUE) {
			return value;
		}

		this.del(key);

		return value;
	}

	public ttl(key: Key, ttl: Seconds, expiresFrom?: UnixTimestamp): boolean {
		return this.config.middleEnd.ttl(key, ttl, expiresFrom);
	}

	public has(key: Key): boolean {
		return this.config.middleEnd.get(key) !== NOT_FOUND_VALUE;
	}

	public del(key: Key): boolean {
		const deleted = this.config.middleEnd.del(key);
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
		return this.config.middleEnd.keys();
	}

	public get stats(): CacheStats {
		return object.cloneDeep(this.config.middleEnd.stats);
	}

	public get size(): number {
		return this.config.middleEnd.size;
	}

	public get empty(): boolean {
		return this.size !== 0;
	}

	public clear(): void {
		this.config.middleEnd.clear();
		this.emit('flush');
	}

	public on(event: EventType, listener: EventListener<Key, Value>): this {
		return super.on(event, listener);
	}

	private internalSet(key: Key, value: Value, ttl?: number, expiresFrom?: number, withCloning = true) {
		value = withCloning && this.config.useClones ? object.cloneDeep(value) : value;
		ttl = ttl ?? this.config.ttlRegistry.resolve(key);

		this.config.middleEnd.set(key, value, ttl, expiresFrom);
		this.emit('set', key, value);

		return this;
	}

	private static fillWithDefaults<K, V>(options?: Partial<MemCacheOptions<K, V>>): MemCacheOptions<K, V> {
		options = options || {};
		options.useClones = options.useClones || false;
		options.middleEnd = options.middleEnd || new OpaqueMiddleEnd<K, V>(new EsMapBackend());
		options.ttlRegistry = options.ttlRegistry || TtlRegistry.empty<K>();
		return options as MemCacheOptions<K, V>;
	}
}

export { Cache, MemCacheOptions };

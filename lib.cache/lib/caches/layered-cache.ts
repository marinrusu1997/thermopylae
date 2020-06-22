import { async } from '@thermopylae/lib.utils';
import { Index, Label, Seconds, StatusFlag, UnixTimestamp } from '@thermopylae/core.declarations';
import debounce from 'lodash.debounce';
import { CacheStats, EventListener, EventType } from '../contracts/cache';
import { AsyncCache } from '../contracts/async-cache';
import { createException, ErrorCodes } from '../error';

type Retriever<K, V> = (key: K) => Promise<V | undefined>;

interface LayeredCacheOptions<K, V> {
	readonly layers: Array<AsyncCache<K, V>>;
	readonly retriever?: Retriever<K, V>;
}

interface LayeredCacheConfig<K, V> extends LayeredCacheOptions<K, V> {
	readonly labels: Map<Label, Index>;
}

class LayeredCache<Key = string, Value = any> implements AsyncCache<Key, Value> {
	private readonly config: LayeredCacheConfig<Key, Value>;

	private readonly rwCondVar: async.LabeledConditionalVariable<Key, Value>;

	constructor(opts: LayeredCacheOptions<Key, Value>) {
		LayeredCache.assertOptions(opts);
		this.disableConcurrentAccessProtectionForCacheLayers(opts.layers);

		this.config = LayeredCache.buildConfig(opts);
		this.rwCondVar = new async.LabeledConditionalVariable<Key, Value>();
	}

	public async get(key: Key, ttlPerLayer?: Map<Label, Seconds>): Promise<Value | undefined> {
		const [acquired, lock] = this.rwCondVar.wait(key);
		if (!acquired) {
			return lock; // consumers will wait on promise
		}

		try {
			let value: Value | undefined;
			const layerMisses: Array<AsyncCache<Key, Value>> = [];

			for (const layer of this.config.layers) {
				if ((value = await layer.get(key)) !== undefined) {
					break;
				}
				layerMisses.push(layer);
			}

			if ((value || (value === undefined && this.config.retriever && (value = await this.config.retriever(key)) !== undefined)) && layerMisses.length) {
				await Promise.all(layerMisses.map((layerMiss) => layerMiss.set(key, value!, ttlPerLayer?.get(layerMiss.name))));
			}

			this.rwCondVar.notifyAll(key, value);
		} catch (e) {
			this.rwCondVar.notifyAll(key, e);
		}

		return lock;
	}

	public async mget(keys: Array<Key>, ttlPerLayer?: Map<Key, Map<Label, Seconds>>): Promise<Map<Key, Value | undefined>> {
		const entries = await Promise.all(keys.map((key) => this.get(key, ttlPerLayer?.get(key)).then((value) => [key, value])));
		return new Map<Key, Value>(entries as Array<[Key, Value]>);
	}

	public async set(key: Key, value: Value, ttl?: Seconds, from?: UnixTimestamp, depth?: number): Promise<void> {
		if (ttl != null) {
			throw createException(ErrorCodes.INVALID_ARGUMENT, `${LayeredCache.name}::${this.set.name} does not support ttl argument`);
		}
		if (from != null) {
			throw createException(ErrorCodes.INVALID_ARGUMENT, `${LayeredCache.name}::${this.set.name} does not support from argument`);
		}

		// NOTICE get/set share same lock, this means consumers will always get the latest value set into cache
		// HOWEVER, this is valid only in the scope of current process and when access to caches is made only from a single instance
		// ULTIMATE, getting the latest fresh value implies calling another special sync operation
		const [acquired, lock] = this.rwCondVar.wait(key); // we also need held by, write needs exclusive access, must be set a special label, or get from calling function name
		if (!acquired) {
			return (lock as unknown) as Promise<void>; // consumers will wait on promise
		}

		try {
			depth = LayeredCache.assertLayerDepth(this.config.layers, depth) || this.config.layers.length;

			const setValuePromises: Array<Promise<void>> = new Array(depth);
			// setting priority: fastest -> slowest cache
			for (let i = 0; i < depth; i++) {
				setValuePromises[i] = this.config.layers[i].set(key, value);
			}
			await Promise.all(setValuePromises);

			this.rwCondVar.notifyAll(key);
		} catch (e) {
			this.rwCondVar.notifyAll(key, e);
		}

		return (lock as unknown) as Promise<void>; // producer will wait on promise
	}

	upset(key: Key, value: Value, ttl?: Seconds, from?: UnixTimestamp): Promise<void> {
		// recursive
	}

	take(key: Key): Promise<Value | undefined> {
		// recursive take
	}

	has(key: Key): Promise<boolean> {
		// recursive check
	}

	del(key: Key): Promise<boolean> {
		// recursive check
	}

	mdel(keys: Array<Key>): Promise<void> {
		// recursive check
	}

	public ttl(key: Key, ttl: Seconds, from?: UnixTimestamp, layerId?: LayerId): Promise<boolean> {
		return this.resolveLayer(layerId).ttl(key, ttl, from);
	}

	public keys(layerName?: Label): Promise<Array<Key>> {
		return this.resolveLayer(layerName).keys();
	}

	public stats(): CacheStats {
		return this.config.layers
			.map((layer) => layer.stats())
			.reduce(
				(prev, curr) => ({
					hits: curr.hits + prev.hits,
					misses: curr.misses + prev.misses
				}),
				{ hits: 0, misses: 0 }
			);
	}

	public async clear(): Promise<void> {
		const layeredClear = this.config.layers.map((cache) => cache.clear());
		await Promise.all(layeredClear);
	}

	public empty(): Promise<boolean> {
		return this.size.then((size) => size === 0);
	}

	public get size(): Promise<number> {
		return this.firstLayer.size;
	}

	public on(event: EventType, listener: EventListener<Key, Value>): this {
		const debouncedListener = debounce(listener, 300, { leading: true, trailing: false });
		for (const layer of this.config.layers) {
			layer.on(event, debouncedListener);
		}
		return this;
	}

	public concurrentAccessProtection(): void {
		throw createException(ErrorCodes.FORBIDDEN, `${LayeredCache.name} always needs enabled ${this.concurrentAccessProtection.name}`);
	}

	public sync(key: Key): Promise<void> {
		// here we need to sync all caches, this is a hard operation
	}

	public msync(keys: Array<Key>): Promise<void> {}

	public layer(id: LayerId): AsyncCache<Key, Value> {
		let index: number;
		switch (typeof id) {
			case 'number':
				this.assertLayerDepth(id);
				index = id;
				break;
			case 'string':
				index = this.layerDepth(id);
				break;
			default:
				throw createException(ErrorCodes.INVALID_LAYER, `Provided id type ${typeof id} is not valid. Expected: number or string.`);
		}
		return this.config.layers[index];
	}

	private acquireAllLocks(keys: ReadonlyArray<Key>): Set<Key> {
		const acquiredLocks: Set<Key> = new Set<Key>();

		for (const key of keys) {
			if (!this.rwCondVar.wait(key)[0]) {
				break;
			}
			acquiredLocks.add(key);
		}

		if (acquiredLocks.size !== keys.length) {
			// unlock buddy
			for (const key of acquiredLocks) {
				this.rwCondVar.notifyAll(key, createException(ErrorCodes.LOCK_FAILURE, `Failed to acquire lock for ${key} in mlock operation.`));
			}

			throw createException(ErrorCodes.LOCK_FAILURE, `Failed to acquire locks for given keys: ${keys.join(', ')}`);
		}

		return acquiredLocks;
	}

	private layerDepth(label: string): number {
		if (!this.config.labels) {
			throw createException(ErrorCodes.INVALID_LAYER, `Provided layer label ${label} can't be used, because labels map was not set`);
		}
		const index = this.config.labels.get(label);
		if (index == null) {
			throw createException(ErrorCodes.INVALID_LAYER, `Provided layer label ${label} doesn't exist`);
		}
		return index;
	}

	private get firstLayer(): AsyncCache<Key, Value> {
		return this.config.layers[0];
	}

	private resolveLayer(layerId?: LayerId): AsyncCache<Key, Value> {
		return layerId ? this.layer(layerId) : this.firstLayer;
	}

	private disableConcurrentAccessProtectionForCacheLayers(layers: Array<AsyncCache<Key, Value>>): void {
		for (const layer of layers) {
			layer.concurrentAccessProtection(StatusFlag.DISABLED);
		}
	}

	private static assertOptions<K, V>(config: LayeredCacheOptions<K, V>): void {
		if (config.layers == null || !config.layers.length) {
			throw createException(ErrorCodes.MISCONFIGURATION, 'At least 1 layer needs to be provided.');
		}
		if (config.retriever != null && typeof config.retriever !== 'function') {
			throw createException(
				ErrorCodes.MISCONFIGURATION,
				'Retriever must be an async function which for a given set of keys should provide a map of values.'
			);
		}
	}

	private static assertLayerDepth<K, V>(layers: Array<AsyncCache<K, V>>, depth?: number): number | null {
		if (depth == null) {
			return null;
		}

		const minDepth = 1;
		const maxDepth = layers.length;

		if (depth < minDepth || depth > maxDepth) {
			throw createException(ErrorCodes.INVALID_LAYER, `Provided layer depth ${depth} must range between ${minDepth} and ${maxDepth}`);
		}

		return depth;
	}

	/**
	 * When multiple operations can run concurrently on the same {@link key},
	 * acquiring a single lock might cause unexpected behaviour.
	 * Therefore we need to acquire lock on the {@link key} namespaced with the {@link operation} name.
	 * This way, a new different lock will be acquired by each operation when using the same {@link key}.
	 *
	 * @param key			Key operations are performed on
	 * @param operation		Operation name
	 */
	private static namespaceKeyWithOperationName<K>(key: K, operation: string): string {
		return key + operation;
	}

	private static buildConfig<K, V>(options: LayeredCacheOptions<K, V>): LayeredCacheConfig<K, V> {
		const labels: Map<Label, Index> = new Map<Label, Index>();
		for (let i = 0; i < options.layers.length; i++) {
			labels.set(options.layers[i].name, i);
		}
		return {
			layers: options.layers,
			labels,
			retriever: options.retriever
		};
	}
}

export { LayeredCache, LayeredCacheOptions, Retriever };

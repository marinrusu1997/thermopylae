import { async } from '@thermopylae/lib.utils';
import { Index, Label, Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import debounce from 'lodash.debounce';
import { EventType, EventListener, CacheStats, CachedItem } from '../contracts/cache';
import { AsyncCache } from '../contracts/async-cache';
import { createException, ErrorCodes } from '../error';

type LayerId = number | string;

type Retriever<K, V> = (key: Set<K> | K) => Promise<Map<K, V> | V>;

interface LayeredCacheOptions<K, V> {
	layers: Array<AsyncCache<K, V>>;
	labels?: Map<Label, Index>;
	retriever?: Retriever<K, V>;
}

class LayeredCache<Key = string, Value = any> implements AsyncCache<Key, Value> {
	private readonly config: LayeredCacheOptions<Key, Value>;

	private readonly rwCondVar: async.LabeledConditionalVariable<Key, Value>;

	constructor(opts: LayeredCacheOptions<Key, Value>) {
		this.assertConfig(opts);
		this.config = opts;
		this.rwCondVar = new async.LabeledConditionalVariable<Key, Value>();
	}

	public async get(key: Key, ttls?: Map<LayerId, Seconds>): Promise<Value | undefined> {
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

			if (value || (value === undefined && this.config.retriever && (value = (await this.config.retriever(key)) as Value) !== undefined)) {
			}

			this.rwCondVar.notifyAll(key, value);
		} catch (e) {
			this.rwCondVar.notifyAll(key, e);
		}

		return lock;

		// we go sequentially to each layer and ask for key
		// during this we register misses per layer
		// if we reached last layer, invoke retriever (if provided)
		// when we go back, for each layer miss, we set the key with the ttl from ttls or no ttl
		// when we are done, we notify
		// then return result to producer
	}

	mget(keys: Array<Key>): Promise<Array<CachedItem<Key, Value>>> {
		// recursive
	}

	set(key: Key, value: Value, ttl?: Seconds, from?: UnixTimestamp): Promise<void> {
		// recursive
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

	public keys(layerId?: LayerId): Promise<Array<Key>> {
		return this.resolveLayer(layerId).keys();
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

	private assertConfig(config: LayeredCacheOptions<Key, Value>): void {
		if (config.layers == null || !config.layers.length) {
			throw createException(ErrorCodes.MISCONFIGURATION, 'At least 1 layer needs to be provided.');
		}
		if (config.labels != null) {
			if (!(config.labels instanceof Map)) {
				throw createException(ErrorCodes.MISCONFIGURATION, 'Labels must be a map of label -> layer index.');
			}
			config.labels.forEach((index, label) => this.assertLayerDepth(index, label));
		}
		if (config.retriever != null && typeof config.retriever !== 'function') {
			throw createException(
				ErrorCodes.MISCONFIGURATION,
				'Retriever must be an async function which for a given set of keys should provide a map of values.'
			);
		}
	}

	private assertLayerDepth(depth: number, label?: string): void {
		const minIndex = 0;
		const maxIndex = this.config.layers.length - 1;

		if (depth < minIndex || depth > maxIndex) {
			throw createException(
				ErrorCodes.INVALID_LAYER,
				`Provided layer depth ${depth} ${label ? `for label ${label}` : ''} must range between ${minIndex} and ${maxIndex}`
			);
		}
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
}

export { LayeredCache, LayeredCacheOptions, LayerId, Retriever };

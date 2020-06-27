import { concurrency } from '@thermopylae/lib.async';
import { Index, Label, Seconds, StatusFlag, Undefinable, UnixTimestamp } from '@thermopylae/core.declarations';
import debounce from 'lodash.debounce';
import { LockedOperation } from '@thermopylae/lib.async/dist/concurrency';
import { CacheStats, EventListener, EventType } from '../contracts/cache';
import { AsyncCache } from '../contracts/async-cache';
import { NOT_FOUND_VALUE } from '../constants';
import { createException, ErrorCodes } from '../error';

const { LockedOperation, LabeledConditionalVariable } = concurrency;

type Retriever<K, V> = (key: K) => Promise<V | undefined>;

type LayerId = Label | number;

interface LayeredCacheOptions<K, V> {
	readonly layers: Array<AsyncCache<K, V>>;
	readonly retriever?: Retriever<K, V>;
}

interface LayeredCacheConfig<K, V> extends LayeredCacheOptions<K, V> {
	readonly labels: Map<Label, Index>;
}

class LayeredCache<Key = string, Value = any> implements AsyncCache<Key, Value> {
	private readonly config: LayeredCacheConfig<Key, Value>;

	private readonly synchronization: concurrency.LabeledConditionalVariable<Key, Value>;

	constructor(opts: LayeredCacheOptions<Key, Value>) {
		LayeredCache.assertOptions(opts);
		this.disableConcurrentAccessProtectionForCacheLayers(opts.layers);

		this.config = LayeredCache.buildConfig(opts);
		this.synchronization = new LabeledConditionalVariable<Key, Value>();
	}

	public get(key: Key, ttlPerLayer?: Map<Label, Seconds>): Promise<Undefinable<Value>> {
		// FIXME maybe use WRITE, because we also write values if they missed
		return this.synchronization.lockedRun(key, LockedOperation.READ, null, this.doGet, key, ttlPerLayer);
	}

	public async mget(keys: Array<Key>, ttlPerLayer?: Map<Key, Map<Label, Seconds>>): Promise<Map<Key, Value>> {
		// FIXME addapt for multiple retriever

		const getValue = (key: Key): Promise<[Key, Value]> => {
			return this.get(key, ttlPerLayer?.get(key)).then((value) => [key, value]);
		};

		const entries: Array<[Key, Value]> = [];

		// this will prevent from lock being not unlocked from a key if get for another key fails
		// also will try to get values for all of the keys
		const results = await Promise.allSettled(keys.map(getValue));

		let i = results.length;
		while (i--) {
			if (results.status === 'fulfilled') {
				entries.push(results.value);
			}
		}

		return new Map<Key, Value>(entries);
	}

	public set(key: Key, value: Value, ttl?: Seconds, from?: UnixTimestamp, depth?: number): Promise<void> {
		return this.synchronization.lockedRun(key, LockedOperation.WRITE, null, this.doSet, key, value, ttl, from, depth);
	}

	public upset(key: Key, value: Value, ttl?: Seconds, from?: UnixTimestamp, depth?: number): Promise<void> {
		return this.synchronization.lockedRun(key, LockedOperation.WRITE, null, this.doUpset, key, value, ttl, from, depth);
	}

	public take(key: Key, depth?: number): Promise<Undefinable<Value>> {
		return this.synchronization.lockedRun(key, LockedOperation.WRITE, null, this.doTake, key, depth);
	}

	public has(key: Key): Promise<boolean> {
		// @ts-ignore
		return this.synchronization.lockedRun(key, LockedOperation.READ, null, this.doHas, key);
	}

	public del(key: Key, depth?: number): Promise<boolean> {
		// @ts-ignore
		return this.synchronization.lockedRun(key, LockedOperation.WRITE, null, this.doDel, key, depth);
	}

	public async mdel(keys: Array<Key>, depth?: number): Promise<void> {
		await Promise.all(keys.map((key) => this.del(key, depth)));
	}

	public ttl(key: Key, ttl: Seconds, from?: UnixTimestamp, layerId?: LayerId): Promise<boolean> {
		// FIXME test how it behaves with concurrent read/write operations
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
		// FIXME test how it behaves with concurrent read/write operations
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
		return this.synchronization.lockedRun(key, LockedOperation.WRITE, null, this.doSync, key);
	}

	public layer(id: LayerId): AsyncCache<Key, Value> {
		let index: number;
		switch (typeof id) {
			case 'number':
				LayeredCache.assertLayerDepth(this.config.layers.length, id);
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

	private doGet = async (key: Key, ttlPerLayer?: Map<Label, Seconds>): Promise<Undefinable<Value>> => {
		let value: Undefinable<Value>;
		const layerMisses: Array<AsyncCache<Key, Value>> = [];

		for (const layer of this.config.layers) {
			if (foundValue((value = await layer.get(key)))) {
				break;
			}
			layerMisses.push(layer);
		}

		if (!foundValue(value) && this.config.retriever) {
			value = await this.config.retriever(key);
		}

		if (foundValue(value) && layerMisses.length) {
			// eslint-disable-next-line no-inner-declarations
			function setMissingValue(layerMiss: AsyncCache<Key, Value>): Promise<void> {
				return layerMiss.set(key, value!, ttlPerLayer?.get(layerMiss.name));
			}

			await Promise.all(layerMisses.map(setMissingValue));
		}

		return value;
	};

	private doSet = async (key: Key, value: Value, ttl?: Seconds, from?: UnixTimestamp, depth?: number): Promise<void> => {
		if (ttl != null) {
			throw createException(ErrorCodes.INVALID_ARGUMENT, `${LayeredCache.name}::${this.set.name} does not support ttl argument`);
		}
		if (from != null) {
			throw createException(ErrorCodes.INVALID_ARGUMENT, `${LayeredCache.name}::${this.set.name} does not support from argument`);
		}

		depth = LayeredCache.assertLayerDepth(this.config.layers.length, depth) || this.config.layers.length;

		const setValue: Array<Promise<void>> = new Array(depth);
		while (depth--) {
			setValue[depth] = this.config.layers[depth].set(key, value);
		}

		await Promise.all(setValue);
	};

	private doUpset = async (key: Key, value: Value, ttl?: Seconds, from?: UnixTimestamp, depth?: number): Promise<void> => {
		if (ttl != null) {
			throw createException(ErrorCodes.INVALID_ARGUMENT, `${LayeredCache.name}::${this.upset.name} does not support ttl argument`);
		}
		if (from != null) {
			throw createException(ErrorCodes.INVALID_ARGUMENT, `${LayeredCache.name}::${this.upset.name} does not support from argument`);
		}

		depth = LayeredCache.assertLayerDepth(this.config.layers.length, depth) || this.config.layers.length;

		const upsetValue: Array<Promise<void>> = new Array(depth);
		while (depth--) {
			upsetValue[depth] = this.config.layers[depth].upset(key, value);
		}
		await Promise.all(upsetValue);
	};

	private doTake = async (key: Key, depth?: number): Promise<Undefinable<Value>> => {
		depth = LayeredCache.assertLayerDepth(this.config.layers.length, depth) || this.config.layers.length;

		const takeFromLayers = new Array<Undefinable<Value>>();
		for (let i = 0; i < depth; i++) {
			takeFromLayers[i] = this.config.layers[i].take(key);
		}
		const values = await Promise.all(takeFromLayers);

		// return value from most depth-ted layer
		let i = values.length;
		while (i--) {
			if (foundValue(values[i])) {
				return values[i];
			}
		}

		return NOT_FOUND_VALUE;
	};

	private doHas = async (key: Key): Promise<boolean> => {
		for (const layer of this.config.layers) {
			if (await layer.has(key)) {
				return true;
			}
		}
		return false;
	};

	private doDel = async (key: Key, depth?: number): Promise<boolean> => {
		depth = LayeredCache.assertLayerDepth(this.config.layers.length, depth) || this.config.layers.length;

		const delFromLayers = new Array<Promise<boolean>>();
		for (let i = 0; i < depth; i++) {
			delFromLayers[i] = this.config.layers[i].del(key);
		}
		const statuses = await Promise.all(delFromLayers);

		return statuses.reduce((prev, curr) => prev && curr, true);
	};

	private doSync = async (key: Key): Promise<void> => {
		// retriever -> slowest -> fastest
		let value: Undefinable<Value>;

		if (this.config.retriever && !foundValue((value = await this.config.retriever(key)))) {
			const eraseFromLayers = this.config.layers.map((layer) => layer.del(key));
			await Promise.all(eraseFromLayers);
			return;
		}

		let i = this.config.layers.length;
		while (!foundValue(value) && i--) {
			value = await this.config.layers[i].get(key);
		}

		const replaceInLayers = new Array<Promise<void>>(i);
		while (i--) {
			replaceInLayers[i] = this.config.layers[i].upset(key, value);
		}
		await Promise.all(replaceInLayers);
	};

	private layerDepth(label: string): number {
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

	private static assertLayerDepth(layersNo: number, depth?: number): number | null {
		if (depth == null) {
			return null;
		}

		const minDepth = 1;
		const maxDepth = layersNo;

		if (depth < minDepth || depth > maxDepth) {
			throw createException(ErrorCodes.INVALID_LAYER, `Provided layer depth ${depth} must range between ${minDepth} and ${maxDepth}`);
		}

		return depth;
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

function foundValue<V>(value: V): boolean {
	return value !== NOT_FOUND_VALUE;
}

export { LayeredCache, LayeredCacheOptions, Retriever };

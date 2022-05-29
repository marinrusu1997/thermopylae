import { PromiseHolder, Undefinable } from '@thermopylae/core.declarations';
import { Cache, CacheEvent, CacheEventListener } from '../contracts/cache';

/**
 * Asynchronous function which retrieves *value* of the `key`.
 *
 * @param key	Key, value of which needs to be retrieved.
 *
 * @returns		A tuple containing value of the key and optional argument's bundle used for key insertion. <br/>
 * 				Notice that `null` is a valid value.
 * 				If key doesn't have any value, `undefined` needs to be returned. <br/>
 * 				If arguments bundle will be returned, it will override the one returned by {@link KeyConfigProvider}.
 * 				If arguments bundle won't be returned, the one returned by {@link KeyConfigProvider} will be used.
 */
type KeyRetriever<Key, Value, ArgumentsBundle = unknown> = (key: Key) => Promise<[Value | undefined, ArgumentsBundle | undefined]>;

/**
 * Function which provides arguments bundle used by different cache operations (for the moment only {@link Cache.set} operation)
 * for the specified `key`.
 *
 * @param key	Key, args bundle of which is needed.
 *
 * @returns		Arguments bundle. If `key` doesn't require any arguments, `undefined` needs to be returned.
 */
type KeyConfigProvider<Key, ArgumentsBundle> = (key: Key) => ArgumentsBundle | undefined;

interface RenewableCacheOptions<Key, Value, ArgumentsBundle> {
	/**
	 * Synchronous implementation of the {@link Cache}.
	 */
	cache: Cache<Key, PromiseHolder<Undefinable<Value>>, ArgumentsBundle>;
	/**
	 * Retriever function.
	 */
	keyRetriever: KeyRetriever<Key, Value, ArgumentsBundle>;
	/**
	 * Optional key config provider which will be used when no explicit arguments bundle was provided to cache operation.
	 */
	keyConfigProvider?: KeyConfigProvider<Key, ArgumentsBundle>;
}

/**
 * Asynchronous implementation of the {@link Cache}, which auto fills itself by using {@link KeyRetriever}. <br/>
 * In case key was requested and it's missing, retriever will be called to obtain it's value
 * which will be saved in the cache and then returned to client. <br/>
 * If you don't want to pass each time same arguments bundle for cache operations, you can provide a {@link KeyConfigProvider}.
 * This function will be called each time an operation is performed on `key`. Returned arguments bundle will be forwarded
 * to the underlying {@link Cache} implementation. This is especially useful for {@link Cache.get} operation which
 * needs to automatically insert missing keys and use an arguments bundle for them.
 *
 * @template Key				Type of the key.
 * @template Value				Type of the value.
 * @template ArgumentsBundle	Type of the arguments bundle.
 */
class RenewableCache<Key, Value, ArgumentsBundle = unknown> implements Cache<Key, Value, ArgumentsBundle, 'promise', PromiseHolder<Undefinable<Value>>> {
	private readonly options: Readonly<Required<RenewableCacheOptions<Key, Value, ArgumentsBundle>>>;

	public constructor(options: RenewableCacheOptions<Key, Value, ArgumentsBundle>) {
		if (options.keyConfigProvider == null) {
			options.keyConfigProvider = RenewableCache.defaultKeyConfigProvider;
		}
		this.options = options as Readonly<Required<RenewableCacheOptions<Key, Value, ArgumentsBundle>>>;
	}

	/**
	 * @inheritDoc
	 */
	public get size(): number {
		return this.options.cache.size;
	}

	/**
	 * @inheritDoc
	 */
	public async get(key: Key, argsBundle?: ArgumentsBundle): Promise<Value | undefined> {
		let promiseHolder = this.options.cache.get(key);
		if (promiseHolder) {
			return promiseHolder.promise;
		}

		promiseHolder = RenewableCache.buildPromiseHolder();
		if (argsBundle == null) {
			argsBundle = this.options.keyConfigProvider(key);
		}
		this.options.cache.set(key, promiseHolder, argsBundle);

		try {
			let value: Undefinable<Value>;
			[value, argsBundle] = await this.options.keyRetriever(key);

			promiseHolder.resolve(value);

			if (value === undefined) {
				this.options.cache.del(key);
			} else if (argsBundle != null) {
				this.options.cache.set(key, promiseHolder, argsBundle);
			}

			return value;
		} catch (e) {
			this.options.cache.del(key); // revert cache insertion
			promiseHolder.reject(e); // notify those who already w8 on promise
			throw e; // notify client that called retriever and obtained exception
		}
	}

	/**
	 * @inheritDoc
	 */
	public has(key: Key): boolean {
		return this.options.cache.has(key);
	}

	/**
	 * Insert/update *key*-*value* pair. <br/>
	 * Due to auto fill nature of the cache, you can use this method explicitly set a value for the key and (maybe)
	 * overwrite the value provided by retriever.
	 *
	 * @param key			Key.
	 * @param value			Value.
	 * @param argsBundle	Arguments bundle.
	 */
	public set(key: Key, value: Value, argsBundle?: ArgumentsBundle): void {
		const promiseHolder = RenewableCache.buildPromiseHolder<Undefinable<Value>>();
		promiseHolder.resolve(value);

		if (argsBundle == null) {
			argsBundle = this.options.keyConfigProvider(key);
		}
		this.options.cache.set(key, promiseHolder, argsBundle);
	}

	/**
	 * @inheritDoc
	 */
	public del(key: Key): boolean {
		return this.options.cache.del(key);
	}

	/**
	 * @inheritDoc
	 */
	public clear(): void {
		this.options.cache.clear();
	}

	/**
	 * @inheritDoc
	 */
	public keys(): Array<Key> {
		return this.options.cache.keys();
	}

	/**
	 * @inheritDoc
	 */
	public on(event: CacheEvent, listener: CacheEventListener<Key, PromiseHolder<Value | undefined>>): this {
		this.options.cache.on(event, listener);
		return this;
	}

	/**
	 * @inheritDoc
	 */
	public off(event: CacheEvent, listener: CacheEventListener<Key, PromiseHolder<Value | undefined>>): this {
		this.options.cache.off(event, listener);
		return this;
	}

	private static buildPromiseHolder<T>(): PromiseHolder<T> {
		const promiseHolder: PromiseHolder<T> = {
			// @ts-ignore They will be assigned bellow by Promise executor
			promise: null,
			// @ts-ignore They will be assigned bellow by Promise executor
			reject: null,
			// @ts-ignore They will be assigned bellow by Promise executor
			resolve: null
		};
		promiseHolder.promise = new Promise<T>((resolve, reject) => {
			promiseHolder.resolve = resolve;
			promiseHolder.reject = reject;
		});
		return promiseHolder;
	}

	private static defaultKeyConfigProvider(): undefined {
		return undefined;
	}
}

export { RenewableCache, KeyRetriever, KeyConfigProvider };

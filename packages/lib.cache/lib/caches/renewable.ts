import { PromiseHolder } from '@thermopylae/core.declarations';
import { Cache, CacheEvent, CacheEventListener } from '../contracts/cache';

type KeyRetriever<Key, Value> = (key: Key) => Promise<Value | undefined>;
type KeyConfigProvider<Key, ArgumentsBundle> = (key: Key) => ArgumentsBundle | undefined;

interface RenewableCacheOptions<Key, Value, ArgumentsBundle> {
	cache: Cache<Key, PromiseHolder<Value>, ArgumentsBundle>;
	keyRetriever: KeyRetriever<Key, Value>;
	keyConfigProvider?: KeyConfigProvider<Key, ArgumentsBundle>;
}

class RenewableCache<Key, Value, ArgumentsBundle = unknown> implements Cache<Key, Value, ArgumentsBundle, 'promise'> {
	private readonly options: Readonly<Required<RenewableCacheOptions<Key, Value, ArgumentsBundle>>>;

	public constructor(options: RenewableCacheOptions<Key, Value, ArgumentsBundle>) {
		if (options.keyConfigProvider == null) {
			options.keyConfigProvider = RenewableCache.defaultKeyConfigProvider;
		}
		this.options = options as Readonly<Required<RenewableCacheOptions<Key, Value, ArgumentsBundle>>>;
	}

	public get size(): number {
		return this.options.cache.size;
	}

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
			const result = await this.options.keyRetriever(key);
			if (result === undefined) {
				this.options.cache.del(key);
			}

			promiseHolder.resolve(result);
			return result;
		} catch (e) {
			this.options.cache.del(key); // revert cache insertion
			promiseHolder.reject(e); // notify those who already w8 on promise
			throw e; // notify client that called retriever and obtained exception
		}
	}

	public has(key: Key): boolean {
		return this.options.cache.has(key);
	}

	public set(key: Key, value: Value, argsBundle?: ArgumentsBundle): void {
		const promiseHolder = RenewableCache.buildPromiseHolder<Value>();
		promiseHolder.resolve(value);

		if (argsBundle == null) {
			argsBundle = this.options.keyConfigProvider(key);
		}
		this.options.cache.set(key, promiseHolder, argsBundle);
	}

	public del(key: Key): boolean {
		return this.options.cache.del(key);
	}

	public clear(): void {
		this.options.cache.clear();
	}

	public keys(): Array<Key> {
		return this.options.cache.keys();
	}

	// @ts-ignore
	public on(event: CacheEvent, listener: CacheEventListener<Key, PromiseHolder<Value>>): this {
		this.options.cache.on(event, listener);
	}

	// @ts-ignore
	public off(event: CacheEvent, listener: CacheEventListener<Key, PromiseHolder<Value>>): this {
		this.options.cache.off(event, listener);
	}

	private static buildPromiseHolder<T>(): PromiseHolder<T> {
		const promiseHolder: PromiseHolder<T> = {
			// @ts-ignore
			promise: null,
			// @ts-ignore
			reject: null,
			// @ts-ignore
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

export { RenewableCache, KeyRetriever, PromiseHolder };

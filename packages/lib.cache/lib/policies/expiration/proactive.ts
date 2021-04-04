import { AbsoluteExpirationPolicy, AbsoluteExpirationPolicyArgumentsBundle } from './absolute';
import { EntryValidity } from '../../contracts/cache-replacement-policy';
import { GarbageCollector } from '../../garbage-collectors/interface';
import { EXPIRES_AT_SYM, INFINITE_EXPIRATION } from '../../constants';
import { HeapGarbageCollector } from '../../garbage-collectors/heap-gc';
import { ExpirableCacheEntry } from './abstract';

/**
 * Expiration policy which evicts keys on it's behalf in the background. <br/>
 * Expired keys are tracked with the help of {@link GarbageCollector}, which evicts them asynchronously when they expire. <br/>
 * This kind of policy can be used if you have keys that won't be often queried
 * and you need a background timer which evicts keys as soon as they expire.
 *
 * @template Key				Type of the key.
 * @template Value				Type of the value.
 * @template ArgumentsBundle	Type of the arguments bundle.
 */
class ProactiveExpirationPolicy<
	Key,
	Value,
	ArgumentsBundle extends AbsoluteExpirationPolicyArgumentsBundle = AbsoluteExpirationPolicyArgumentsBundle
> extends AbsoluteExpirationPolicy<Key, Value, ArgumentsBundle> {
	private readonly gc: GarbageCollector<any>; // @fixme a bit hackish...

	/**
	 * @param gc	{@link GarbageCollector} which notifies about expired entries. <br/>
	 * 				Defaults to {@link HeapGarbageCollector}.
	 */
	public constructor(gc?: GarbageCollector<any>) {
		super();
		this.gc = gc || new HeapGarbageCollector<any>();

		this.gc.setEntryExpiredCallback((expiredEntry) => {
			// remove from cache, will trigger `onDelete` which will detach ttl metadata
			this.deleteFromCache(expiredEntry.key, expiredEntry);
		});
	}

	/**
	 * Get the number of tracked for expiration keys.
	 */
	public get size(): number {
		return this.gc.size;
	}

	/**
	 * @inheritDoc
	 */
	public onGet(): EntryValidity {
		// here we should find and remove item from heap, but it would be to expensive to do on each get
		return EntryValidity.VALID;
	}

	/**
	 * @inheritDoc
	 */
	public onSet(key: Key, entry: ExpirableCacheEntry<Key, Value>, options?: ArgumentsBundle): void {
		if (options == null || ProactiveExpirationPolicy.isNonExpirable(options)) {
			return;
		}

		ProactiveExpirationPolicy.setEntryExpiration(entry, options.expiresAfter!, options.expiresFrom);
		entry.key = key;

		this.gc.manage(entry);
	}

	/**
	 * @inheritDoc
	 */
	public onUpdate(key: Key, entry: ExpirableCacheEntry<Key, Value>, options?: ArgumentsBundle): void {
		if (options == null || options.expiresAfter == null) {
			return undefined;
		}

		if (entry[EXPIRES_AT_SYM]) {
			// entry has expiration and it needs to be updated

			if (options.expiresAfter === INFINITE_EXPIRATION) {
				// item was added with ttl, but now it's ttl became INFINITE
				return this.onDelete(key, entry); // we do not track it anymore
			}

			// update expiration
			const oldExpiration = entry[EXPIRES_AT_SYM]!; // keep it
			ProactiveExpirationPolicy.setEntryExpiration(entry, options.expiresAfter, options.expiresFrom); // updates entry expiration `in-place`

			if (oldExpiration === entry[EXPIRES_AT_SYM]) {
				// item was set with a great ttl, time passes, then it's ttl decreased, but summed up, we have same expiration
				return undefined;
			}

			// if it's managed by GC, it needs to have oldExpiration
			return this.gc.update(oldExpiration, entry); // notice that we updated `expiresAt` above
		}

		if (options.expiresAfter !== INFINITE_EXPIRATION) {
			// this is an update of item which had infinite timeout, now we need to track it
			ProactiveExpirationPolicy.setEntryExpiration(entry, options.expiresAfter, options.expiresFrom);
			entry.key = key;

			return this.gc.manage(entry);
		}

		return undefined; // item had infinite ttl, and the new tll is also infinite
	}

	/**
	 * @inheritDoc
	 */
	public onDelete(key: Key, entry: ExpirableCacheEntry<Key, Value>): void {
		this.gc.leave(entry); // do not track it anymore for expiration
		super.onDelete(key, entry); // it has attached metadata only if it was part of the heap (i.e. tracked by this policy)
	}

	/**
	 * @inheritDoc
	 */
	public onClear(): void {
		this.gc.clear();
	}

	/**
	 * **Method used for unit testing purposes!**
	 */
	public isIdle(): boolean {
		return this.gc.idle;
	}
}

export { ProactiveExpirationPolicy };

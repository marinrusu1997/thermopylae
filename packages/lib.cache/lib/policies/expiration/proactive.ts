import { AbsoluteExpirationPolicy, AbsoluteExpirationPolicyArgumentsBundle } from './absolute';
import { EntryValidity } from '../../contracts/replacement-policy';
import { GarbageCollector } from '../../data-structures/garbage-collector/interface';
import { EXPIRES_AT_SYM, INFINITE_TTL } from '../../constants';
import { HeapGarbageCollector } from '../../data-structures/garbage-collector/heap-gc';
import { ExpirableCacheEntry } from './abstract';

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

	public get size(): number {
		return this.gc.size;
	}

	public onGet(): EntryValidity {
		// here we should find and remove item from heap, but it would be to expensive to do on each get
		return EntryValidity.VALID;
	}

	public onSet(key: Key, entry: ExpirableCacheEntry<Key, Value>, options?: ArgumentsBundle): void {
		if (options == null || ProactiveExpirationPolicy.isNonExpirable(options)) {
			return;
		}

		ProactiveExpirationPolicy.setEntryExpiration(entry, options.expiresAfter!, options.expiresFrom);
		entry.key = key;

		this.gc.manage(entry);
	}

	public onUpdate(key: Key, entry: ExpirableCacheEntry<Key, Value>, options?: ArgumentsBundle): void {
		if (options == null || options.expiresAfter == null) {
			return undefined;
		}

		// @fixme test case when item is set, then update with no ttl, then set again !!!
		if (entry[EXPIRES_AT_SYM]) {
			// entry has expiration and it needs to be updated

			if (options.expiresAfter === INFINITE_TTL) {
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

		if (options.expiresAfter !== INFINITE_TTL) {
			// this is an update of item which had infinite timeout, now we need to track it
			ProactiveExpirationPolicy.setEntryExpiration(entry, options.expiresAfter, options.expiresFrom);
			entry.key = key;

			return this.gc.manage(entry);
		}

		return undefined; // item had infinite ttl, and the new tll is also infinite
	}

	public onDelete(key: Key, entry: ExpirableCacheEntry<Key, Value>): void {
		this.gc.leave(entry); // do not track it anymore for expiration
		super.onDelete(key, entry); // it has attached metadata only if it was part of the heap (i.e. tracked by this policy)
	}

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

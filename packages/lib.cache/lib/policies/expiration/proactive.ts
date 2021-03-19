import { AbstractExpirationPolicy, AbstractExpirationPolicyArgumentsBundle, ExpirableCacheKeyedEntry } from './abstract';
import { EntryValidity } from '../../contracts/replacement-policy';
import { GarbageCollector } from '../../data-structures/garbage-collector/interface';
import { EXPIRES_AT_SYM } from '../../constants';
import { HeapGarbageCollector } from '../../data-structures/garbage-collector/heap-gc';

class ProactiveExpirationPolicy<
	Key,
	Value,
	ArgumentsBundle extends AbstractExpirationPolicyArgumentsBundle = AbstractExpirationPolicyArgumentsBundle
> extends AbstractExpirationPolicy<Key, Value, ArgumentsBundle> {
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

	public onSet(key: Key, entry: ExpirableCacheKeyedEntry<Key, Value>, options?: ArgumentsBundle): void {
		if (options == null) {
			return;
		}

		if (ProactiveExpirationPolicy.isNonExpirable(options)) {
			return;
		}

		ProactiveExpirationPolicy.setEntryExpiration(entry, options.expiresAfter!, options.expiresFrom);
		entry.key = key;

		this.gc.manage(entry);
	}

	public onUpdate(key: Key, entry: ExpirableCacheKeyedEntry<Key, Value>, options?: ArgumentsBundle): void {
		const oldExpiration = entry[EXPIRES_AT_SYM];
		super.onUpdate(key, entry, options); // this will update entry ttl with some validations

		if (this.gc.isManaged(entry)) {
			if (entry[EXPIRES_AT_SYM] == null) {
				// item was added with ttl, but now it's ttl became INFINITE
				return this.gc.leave(entry);
			}

			if (oldExpiration === entry[EXPIRES_AT_SYM]) {
				// item was set with a great ttl, time passes, then it's ttl decreased, but summed up, we have same expiration
				return undefined;
			}

			// if it's managed by GC, it needs to have oldExpiration
			return this.gc.update(oldExpiration!, entry); // notice that we updated `expiresAt` above
		}

		if (options && !ProactiveExpirationPolicy.isNonExpirable(options)) {
			// this is an update of item which had infinite timeout, now we need to track it
			entry.key = key;
			return this.gc.manage(entry);
		}

		return undefined; // item had infinite ttl, and the new tll is also infinite
	}

	public onDelete(key: Key, entry: ExpirableCacheKeyedEntry<Key, Value>): void {
		super.onDelete(key, entry); // it has attached metadata only if it was part of the heap (i.e. tracked by this policy)
		this.gc.leave(entry); // do not track it anymore for expiration
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

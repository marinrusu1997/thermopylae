import { array, chrono, number } from '@thermopylae/lib.utils';
import { expect } from '@thermopylae/lib.unit-test';
import { describe, it } from 'mocha';
import colors from 'colors';
import { UnitTestLogger } from '@thermopylae/lib.unit-test/dist/logger';
import { ProactiveExpirationPolicy } from '../../../lib/policies/expiration/proactive';
import { Deleter, EntryValidity } from '../../../lib/contracts/replacement-policy';
import { EXPIRES_AT_SYM, INFINITE_EXPIRATION } from '../../../lib/constants';
import { UniqueKeysGenerator } from '../../utils';
import { HEAP_NODE_IDX_SYM, HeapNode } from '../../../lib/data-structures/heap';
import { ExpirableCacheEntry } from '../../../lib/policies/expiration/abstract';
import { GarbageCollector } from '../../../lib/data-structures/garbage-collector/interface';
import { HeapGarbageCollector } from '../../../lib/data-structures/garbage-collector/heap-gc';
import { BucketGarbageCollector } from '../../../lib/data-structures/garbage-collector/bucket-gc';

interface ExpirableCacheEntryHeapNode<Key, Value> extends ExpirableCacheEntry<Key, Value>, HeapNode {}

function generateEntry<K>(key: K): ExpirableCacheEntryHeapNode<K, any> {
	return {
		key,
		value: array.randomElement(generateEntry.VALUES),
		[EXPIRES_AT_SYM]: undefined,
		// @ts-ignore
		[HEAP_NODE_IDX_SYM]: undefined! // it does need to be here initially when entry is created
	};
}
generateEntry.VALUES = [undefined, null, false, 0, '', {}, []];

function gcFactory(): GarbageCollector<any> {
	const gc = Math.random() >= 0.5 ? new HeapGarbageCollector() : new BucketGarbageCollector();
	// UnitTestLogger.info(`Using ${gc.constructor.name.magenta}`);
	return gc;
}

// @fixme test with both GC
describe(`${colors.magenta(ProactiveExpirationPolicy.name)} spec`, () => {
	const defaultTTL = 1; // second

	describe(`${ProactiveExpirationPolicy.prototype.onSet.name.magenta} spec`, () => {
		it('does not evict item if it has infinite or no ttl', (done) => {
			const policy = new ProactiveExpirationPolicy<string, number>(gcFactory());
			const EVICTED_KEYS = new Array<string>();
			const MAX_TIMEOUT = 1000;
			const TIMEOUT_STEP = 100;

			policy.setDeleter((evictedKey, evictedEntry) => {
				EVICTED_KEYS.push(evictedKey);

				const expirableCacheHeapNode = evictedEntry as ExpirableCacheEntryHeapNode<string, number>;
				policy.onDelete(evictedKey, expirableCacheHeapNode);
				expect(expirableCacheHeapNode[EXPIRES_AT_SYM]).to.be.eq(undefined);
				expect(expirableCacheHeapNode[HEAP_NODE_IDX_SYM]).to.be.eq(undefined);
			});

			for (let timeout = TIMEOUT_STEP; timeout <= MAX_TIMEOUT; timeout += TIMEOUT_STEP) {
				setTimeout(() => {
					expect(EVICTED_KEYS).to.be.ofSize(0);
					expect(policy.size).to.be.eq(0); // it didn't tracks nothing
					if (timeout === MAX_TIMEOUT) {
						done();
					}
				}, timeout);
			}

			policy.onSet('a', generateEntry('a'), { expiresAfter: INFINITE_EXPIRATION });
			policy.onSet('b', generateEntry('b'), { expiresAfter: undefined });
			policy.onSet('c', generateEntry('c'), { expiresAfter: null! });

			expect(policy.size).to.be.eq(0); // it didn't tracks nothing
		});

		it('evicts expired item', (done) => {
			const policy = new ProactiveExpirationPolicy<string, any>(gcFactory());

			const TRACKED_KEY = 'key';
			const WHEN_TRACKING_BEGAN = chrono.unixTime();

			const deleter: Deleter<string, any> = (evictedKey, evictedEntry) => {
				expect(chrono.unixTime() - WHEN_TRACKING_BEGAN).to.be.equals(defaultTTL);
				expect(evictedKey).to.be.equals(TRACKED_KEY);

				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntryHeapNode<string, number>);

				expect(policy.size).to.be.eq(0);
				done();
			};

			policy.setDeleter(deleter);
			policy.onSet(TRACKED_KEY, generateEntry(TRACKED_KEY), { expiresAfter: defaultTTL });
		});

		it('should not allow inserting of items which have ttl in milliseconds', () => {
			const policy = new ProactiveExpirationPolicy<string, any>(gcFactory());

			expect(() => policy.onSet('a', generateEntry('a'), { expiresAfter: 0.1 })).to.throw(`'expiresAfter' needs to be an integer. Given: ${0.1}.`);
			expect(() => policy.onSet('a', generateEntry('a'), { expiresAfter: 1, expiresFrom: 0.1 })).to.throw(
				`'expiresFrom' needs to be an integer. Given: ${0.1}.`
			);
		});

		it('evicts multiple expired keys with same ttl (tracking started at same time)', (done) => {
			const policy = new ProactiveExpirationPolicy<string, any>(gcFactory());

			const trackedKeys = ['key1', 'key2', 'key3'];
			const whenTrackingBegan = chrono.unixTime();

			const deleter: Deleter<string, any> = (evictedKey, evictedEntry) => {
				expect(chrono.unixTime() - whenTrackingBegan).to.be.equals(defaultTTL);
				expect(trackedKeys).to.be.containing(evictedKey);
				trackedKeys.splice(trackedKeys.indexOf(evictedKey), 1); // ensure not called with same key

				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntryHeapNode<string, number>);

				if (trackedKeys.length === 0) {
					process.nextTick(() => {
						expect(policy.size).to.be.eq(0);
						done();
					});
				}
			};

			policy.setDeleter(deleter);
			trackedKeys.forEach((key) => policy.onSet(key, generateEntry(key), { expiresAfter: defaultTTL }));
		});

		it('evicts multiple expired keys with different ttl (tracking started at same time)', (done) => {
			const policy = new ProactiveExpirationPolicy<string, any>(gcFactory());

			const trackedKeysMap = new Map<string, number>();
			trackedKeysMap.set('key1', defaultTTL);
			trackedKeysMap.set('key2', defaultTTL);
			trackedKeysMap.set('key3', defaultTTL + 1);
			trackedKeysMap.set('key4', defaultTTL + 1);

			const whenTrackingBegan = chrono.unixTime();
			const deleter: Deleter<string, any> = (evictedKey, evictedEntry) => {
				expect(chrono.unixTime() - whenTrackingBegan).to.be.equals(trackedKeysMap.get(evictedKey));
				expect(Array.from(trackedKeysMap.keys())).to.be.containing(evictedKey);
				trackedKeysMap.delete(evictedKey); // ensure not called with same key

				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntryHeapNode<string, number>);

				if (trackedKeysMap.size === 0) {
					done();
				}
			};

			policy.setDeleter(deleter);
			trackedKeysMap.forEach((ttl, key) => policy.onSet(key, generateEntry(key), { expiresAfter: ttl }));
		}).timeout(2100);

		it('evicts multiple expired keys with different ttl in the order keys were tracked (tracking stared at different times)', (done) => {
			const policy = new ProactiveExpirationPolicy<string, any>(gcFactory());
			const KEYS_TO_BE_TRACKED = 4;

			const trackedKeysMap = new Map<string, { trackingSince: number; ttl: number }>();
			const trackedKeysSnapshot = ['key1', 'key2', 'key3', 'key4'];

			let currentNumberOfRemovedKeys = 0;

			policy.setDeleter((evictedKey, evictedEntry) => {
				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntryHeapNode<string, number>);

				const trackingInfo = trackedKeysMap.get(evictedKey);

				expect(chrono.unixTime() - trackingInfo!.trackingSince).to.be.equals(trackingInfo!.ttl);
				expect(Array.from(trackedKeysMap.keys())).to.be.containing(evictedKey);

				trackedKeysMap.delete(evictedKey); // ensure not called with same key

				expect(trackedKeysSnapshot[currentNumberOfRemovedKeys]).to.be.equal(evictedKey);

				currentNumberOfRemovedKeys += 1;
				if (currentNumberOfRemovedKeys === KEYS_TO_BE_TRACKED) {
					done();
				}
			});

			trackedKeysMap.set('key1', { trackingSince: chrono.unixTime(), ttl: defaultTTL });
			policy.onSet('key1', generateEntry('key1'), { expiresAfter: defaultTTL });

			setTimeout(() => {
				trackedKeysMap.set('key2', { trackingSince: chrono.unixTime(), ttl: defaultTTL });
				policy.onSet('key2', generateEntry('key2'), { expiresAfter: defaultTTL });
			}, 1000);

			setTimeout(() => {
				trackedKeysMap.set('key3', { trackingSince: chrono.unixTime(), ttl: defaultTTL });
				policy.onSet('key3', generateEntry('key3'), { expiresAfter: defaultTTL });
			}, 2000);

			setTimeout(() => {
				trackedKeysMap.set('key4', { trackingSince: chrono.unixTime(), ttl: defaultTTL });
				policy.onSet('key4', generateEntry('key4'), { expiresAfter: defaultTTL });
			}, 3000);
		}).timeout(4100);

		it('evicts duplicate keys with same ttl', (done) => {
			const policy = new ProactiveExpirationPolicy<string, any>(gcFactory());

			const trackedKeys = ['key', 'key', 'key'];
			const whenTrackingBegan = chrono.unixTime();

			policy.setDeleter((evictedKey, evictedEntry) => {
				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntryHeapNode<string, number>);

				expect(chrono.unixTime() - whenTrackingBegan!).to.be.equals(defaultTTL);
				expect(trackedKeys).to.be.containing(evictedKey);

				trackedKeys.splice(trackedKeys.indexOf(evictedKey), 1); // ensure not called with same key
				if (trackedKeys.length === 0) {
					done();
				}
			});
			trackedKeys.forEach((key) => policy.onSet(key, generateEntry(key), { expiresAfter: defaultTTL }));
		});

		it('restarts gc after all tracked keys were evicted', (done) => {
			const policy = new ProactiveExpirationPolicy<string, any>(gcFactory());

			const trackedKeys = ['key1', 'key2'];
			let whenTrackingBegan: number | undefined;

			const trackKey = (key: string): void => {
				policy.onSet(key, generateEntry(key), { expiresAfter: defaultTTL });
				whenTrackingBegan = chrono.unixTime();
			};

			policy.setDeleter((evictedKey, evictedEntry) => {
				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntryHeapNode<string, number>);

				expect(chrono.unixTime() - whenTrackingBegan!).to.be.eq(defaultTTL);
				expect(trackedKeys).to.be.containing(evictedKey);
				trackedKeys.splice(trackedKeys.indexOf(evictedKey), 1); // ensure not called with same key

				if (trackedKeys.length === 0) {
					done();
				}
			});

			trackKey('key1');

			setTimeout(() => trackKey('key2'), (defaultTTL + 1.5) * 1000);
		}).timeout(3600);

		it('restarts the gc after it was stopped, discarding and its internal list of tracked keys', (done) => {
			const policy = new ProactiveExpirationPolicy<string, number>(gcFactory());

			const trackedKeyBeforeStopping = 'key1';
			const trackedKeyAfterStopping = 'key2';
			let whenTrackingBegan: number | undefined;

			const trackKey = (key: string): void => {
				policy.onSet(key, generateEntry(key), { expiresAfter: defaultTTL });
				whenTrackingBegan = chrono.unixTime();
			};

			policy.setDeleter((evictedKey, evictedEntry) => {
				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntryHeapNode<string, number>);

				expect(chrono.unixTime() - whenTrackingBegan!).to.be.equals(defaultTTL);
				expect(trackedKeyAfterStopping).to.be.equal(evictedKey);

				done();
			});

			trackKey(trackedKeyBeforeStopping);
			policy.onClear();
			setTimeout(() => trackKey(trackedKeyAfterStopping), 1500);
		}).timeout(2600);

		it('is synchronized with nearest element to remove while adding keys', async () => {
			const policy = new ProactiveExpirationPolicy<string, any>(gcFactory());
			const keys = new Set<string>();

			policy.setDeleter((evictedKey, evictedEntry) => {
				keys.delete(evictedKey);
				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});
			expect(policy.isIdle()).to.be.eq(true);

			// adding element with same ttl
			keys.add('key1');
			policy.onSet('key1', generateEntry('key1'), { expiresAfter: 1 });
			expect(policy.isIdle()).to.be.eq(false);
			expect(policy.size).to.be.eq(1);

			keys.add('key2');
			policy.onSet('key2', generateEntry('key2'), { expiresAfter: 1 });
			expect(policy.size).to.be.eq(2);

			await chrono.sleep(1100);
			expect(keys.size).to.be.eq(0);
			expect(policy.size).to.be.eq(0);
			expect(policy.isIdle()).to.be.eq(true);

			// adding element with greater ttl
			keys.add('key1');
			policy.onSet('key1', generateEntry('key1'), { expiresAfter: 1 });
			expect(policy.isIdle()).to.be.eq(false);
			expect(policy.size).to.be.eq(1);

			keys.add('key2');
			policy.onSet('key2', generateEntry('key2'), { expiresAfter: 2 });
			expect(policy.size).to.be.eq(2);

			await chrono.sleep(1100);
			expect(keys.size).to.be.eq(1);
			expect(policy.size).to.be.eq(1);
			expect(keys.has('key1')).to.be.eq(false);
			expect(policy.isIdle()).to.be.eq(false);

			await chrono.sleep(1100);
			expect(keys.size).to.be.eq(0);
			expect(policy.size).to.be.eq(0);
			expect(policy.isIdle()).to.be.eq(true);

			// adding element smaller
			keys.add('key1');
			policy.onSet('key1', generateEntry('key1'), { expiresAfter: 2 });
			expect(policy.isIdle()).to.be.eq(false);
			expect(policy.size).to.be.eq(1);

			keys.add('key2');
			policy.onSet('key2', generateEntry('key2'), { expiresAfter: 1 });
			expect(policy.size).to.be.eq(2);

			await chrono.sleep(1100);
			expect(keys.size).to.be.eq(1);
			expect(policy.size).to.be.eq(1);
			expect(keys.has('key2')).to.be.eq(false);
			expect(policy.isIdle()).to.be.eq(false);

			await chrono.sleep(1100);
			expect(keys.size).to.be.eq(0);
			expect(policy.size).to.be.eq(0);
			expect(policy.isIdle()).to.be.eq(true);
		}).timeout(7000);
	});

	describe(`${ProactiveExpirationPolicy.prototype.onUpdate.name.magenta} spec`, () => {
		it('evicts key sooner if ttl decreased (ttl reported to same expiresFrom)', (done) => {
			const policy = new ProactiveExpirationPolicy<string, number>(gcFactory());
			const EVICTED_KEYS = new Array<string>();
			const KEY = 'a';
			const ENTRY = generateEntry(KEY);
			const OLD_TTL = 2;
			const NEW_TTL = 1;
			policy.setDeleter((evictedKey, evictedEntry) => {
				EVICTED_KEYS.push(evictedKey);
				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(1);
					expect(EVICTED_KEYS).to.be.containing(KEY);
					expect(policy.size).to.be.eq(0);
					expect(policy.isIdle()).to.be.eq(true);
					done();
				} catch (e) {
					done(e);
				}
			}, chrono.secondsToMilliseconds(NEW_TTL) + 30);

			const expiresFrom = chrono.unixTime();
			policy.onSet(KEY, ENTRY, { expiresAfter: OLD_TTL, expiresFrom });
			policy.onUpdate(KEY, ENTRY, { expiresAfter: NEW_TTL, expiresFrom });
		});

		it('evicts key later if ttl increased (ttl reported to same expiresFrom)', (done) => {
			const policy = new ProactiveExpirationPolicy<string, number>(gcFactory());
			const EVICTED_KEYS = new Array<string>();
			const KEY = 'a';
			const ENTRY = generateEntry(KEY);
			const OLD_TTL = 1;
			const NEW_TTL = 2;
			policy.setDeleter((evictedKey, evictedEntry) => {
				EVICTED_KEYS.push(evictedKey);
				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(0);
					expect(policy.size).to.be.eq(1);
					expect(policy.isIdle()).to.be.eq(false);
				} catch (e) {
					clearTimeout(newTtlSetTimeout);
					done(e);
				}
			}, chrono.secondsToMilliseconds(OLD_TTL) + 30);

			const newTtlSetTimeout = setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(1);
					expect(EVICTED_KEYS).to.be.containing(KEY);
					expect(policy.size).to.be.eq(0);
					expect(policy.isIdle()).to.be.eq(true);
					done();
				} catch (e) {
					done(e);
				}
			}, chrono.secondsToMilliseconds(NEW_TTL) + 30);

			const expiresFrom = chrono.unixTime();
			policy.onSet(KEY, ENTRY, { expiresAfter: OLD_TTL, expiresFrom });
			policy.onUpdate(KEY, ENTRY, { expiresAfter: NEW_TTL, expiresFrom });
		}).timeout(2100);

		it('evicts key later if ttl is the same (ttl reported to expiresFrom equal to current timestamp)', (done) => {
			const policy = new ProactiveExpirationPolicy<string, number>(gcFactory());
			const EVICTED_KEYS = new Array<string>();
			const KEY = 'a';
			const ENTRY = generateEntry(KEY);
			const OLD_TTL = 1;
			const NEW_TTL = 1;
			policy.setDeleter((evictedKey, evictedEntry) => {
				EVICTED_KEYS.push(evictedKey);
				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(0);
					expect(policy.size).to.be.eq(1);
					expect(policy.isIdle()).to.be.eq(false);
				} catch (e) {
					clearTimeout(newTtlSetTimeout);
					done(e);
				}
			}, chrono.secondsToMilliseconds(OLD_TTL) + 30);

			const newTtlSetTimeout = setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(1);
					expect(EVICTED_KEYS).to.be.containing(KEY);
					expect(policy.size).to.be.eq(0);
					expect(policy.isIdle()).to.be.eq(true);
					done();
				} catch (e) {
					done(e);
				}
			}, chrono.secondsToMilliseconds(NEW_TTL + OLD_TTL) + 30); // schedule later

			const expiresFrom = chrono.unixTime();
			policy.onSet(KEY, ENTRY, { expiresAfter: OLD_TTL, expiresFrom });
			policy.onUpdate(KEY, ENTRY, { expiresAfter: NEW_TTL, expiresFrom: expiresFrom + 1 }); // schedule later
		}).timeout(2100);

		it("evicts key at it's previous timestamp if new ttl + expiresFrom will have the same eviction timestamp as the latest one", (done) => {
			const policy = new ProactiveExpirationPolicy<string, number>(gcFactory());
			const EVICTED_KEYS = new Array<string>();
			const KEY = 'a';
			const ENTRY = generateEntry(KEY);
			const OLD_TTL = 2;
			const NEW_TTL = 1;
			policy.setDeleter((evictedKey, evictedEntry) => {
				EVICTED_KEYS.push(evictedKey);
				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(1);
					expect(EVICTED_KEYS).to.be.containing(KEY);
					expect(policy.size).to.be.eq(0);
					expect(policy.isIdle()).to.be.eq(true);
					done();
				} catch (e) {
					done(e);
				}
			}, chrono.secondsToMilliseconds(OLD_TTL) + 30); // NEW_TTL will have the same impact

			policy.onSet(KEY, ENTRY, { expiresAfter: OLD_TTL });

			setTimeout(() => {
				policy.onUpdate(KEY, ENTRY, { expiresAfter: NEW_TTL }); // generates same eviction timestamp
			}, chrono.secondsToMilliseconds(NEW_TTL));
		}).timeout(2100);

		it('does not evict key if it had tll, but the new one is infinite', (done) => {
			const policy = new ProactiveExpirationPolicy<string, number>(gcFactory());
			const EVICTED_KEYS = new Array<string>();
			const KEY = 'a';
			const ENTRY = generateEntry(KEY);
			const OLD_TTL = 1;
			policy.setDeleter((evictedKey, evictedEntry) => {
				EVICTED_KEYS.push(evictedKey);
				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(0);
					expect(policy.size).to.be.eq(0); // does not track it
					expect(policy.isIdle()).to.be.eq(true);
					done();
				} catch (e) {
					done(e);
				}
			}, chrono.secondsToMilliseconds(OLD_TTL) + 50);

			const expiresFrom = chrono.unixTime();
			policy.onSet(KEY, ENTRY, { expiresAfter: OLD_TTL, expiresFrom });

			setTimeout(() => {
				policy.onUpdate(KEY, ENTRY, { expiresAfter: INFINITE_EXPIRATION });
			}, 500);
		});

		it("evicts the key if it didn't had tll, and the new ttl is specified", (done) => {
			const policy = new ProactiveExpirationPolicy<string, number>(gcFactory());
			const EVICTED_KEYS = new Array<string>();
			const KEY = 'a';
			const ENTRY = generateEntry(KEY);
			const NEW_TTL = 1;
			policy.setDeleter((evictedKey, evictedEntry) => {
				EVICTED_KEYS.push(evictedKey);
				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});

			policy.onSet(KEY, ENTRY);
			policy.onUpdate(KEY, ENTRY, { expiresAfter: NEW_TTL });

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(1);
					expect(EVICTED_KEYS).to.be.containing(KEY);
					expect(policy.size).to.be.eq(0);
					expect(policy.isIdle()).to.be.eq(true);
					done();
				} catch (e) {
					done(e);
				}
			}, chrono.secondsToMilliseconds(NEW_TTL) + 50);
		});

		it('should do nothing when options or ttl is not given', (done) => {
			const policy = new ProactiveExpirationPolicy<string, number>(gcFactory());
			const EVICTED_KEYS = new Array<string>();
			const KEY = 'a';
			const ENTRY = generateEntry(KEY);
			const NEW_TTL = 1;
			policy.setDeleter((evictedKey, evictedEntry) => {
				EVICTED_KEYS.push(evictedKey);
				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});

			policy.onUpdate(KEY, ENTRY, { expiresAfter: NEW_TTL });

			policy.onUpdate(KEY, ENTRY); // does nothing
			expect(EVICTED_KEYS).to.be.ofSize(0);
			policy.onUpdate(KEY, ENTRY, { expiresAfter: undefined }); // does nothing
			expect(EVICTED_KEYS).to.be.ofSize(0);
			policy.onUpdate(KEY, ENTRY, { expiresAfter: null! }); // does nothing
			expect(EVICTED_KEYS).to.be.ofSize(0);

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(1);
					expect(EVICTED_KEYS).to.be.containing(KEY);
					expect(policy.size).to.be.eq(0);
					expect(policy.isIdle()).to.be.eq(true);
					done();
				} catch (e) {
					done(e);
				}
			}, chrono.secondsToMilliseconds(NEW_TTL) + 50);
		});

		it("does not evict key if it didn't had ttl, and the new ttl is infinite", (done) => {
			const policy = new ProactiveExpirationPolicy<string, number>(gcFactory());
			const EVICTED_KEYS = new Array<string>();
			const KEY = 'a';
			const ENTRY = generateEntry(KEY);
			policy.setDeleter((evictedKey, evictedEntry) => {
				EVICTED_KEYS.push(evictedKey);
				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});

			policy.onSet(KEY, ENTRY, { expiresAfter: undefined });
			setTimeout(() => {
				policy.onUpdate(KEY, ENTRY, { expiresAfter: INFINITE_EXPIRATION });
			}, 500);

			let checkAttempts = 0;
			const intervalId = setInterval(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(0);
					expect(policy.size).to.be.eq(0); // does not track
					expect(policy.isIdle()).to.be.eq(true);

					if (++checkAttempts >= 10) {
						clearInterval(intervalId);
						done();
					}
				} catch (e) {
					clearInterval(intervalId);
					done(e);
				}
			}, 100);
		});

		it('is synchronized with nearest element to remove while adding/updating keys', (done) => {
			const policy = new ProactiveExpirationPolicy<string, any>(gcFactory());
			const CACHE_ACTIVE_KEYS = new Set<string>();

			policy.setDeleter((evictedKey, evictedEntry) => {
				CACHE_ACTIVE_KEYS.delete(evictedKey);
				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});
			expect(policy.isIdle()).to.be.eq(true);

			const MIN_TTL = 1;
			const MAX_TTL = 5;

			const SCHEDULING_TIMES = 500;

			const SCHEDULE_DELETION_MIN_DELAY = 0;
			const SCHEDULE_DELETION_MAX_DELAY = 4;

			const CHECK_INTERVAL_MIN = MIN_TTL;
			const CHECK_INTERVAL_MAX = MAX_TTL * 2;

			const KEYS_DELETION_DELAY = new Map<string, number>();

			function logTestContext(checkIntervalNo?: number): void {
				const message = [
					'Test Context:',
					`${'POLICY_SIZE'.magenta}\t\t: ${policy.size}`,
					`${'CACHE_ACTIVE_KEYS'.magenta}: ${JSON.stringify([...CACHE_ACTIVE_KEYS])}`,
					`${'KEYS_DELETION_DELAY'.magenta}\t: ${JSON.stringify([...KEYS_DELETION_DELAY])}`
				];
				if (checkIntervalNo != null) {
					message.push(`${'CHECK_INTERVAL_NO'.magenta}: ${checkIntervalNo}`);
				}

				UnitTestLogger.info(message.join('\n'));
			}

			for (let checkIntervalNo = CHECK_INTERVAL_MIN; checkIntervalNo <= CHECK_INTERVAL_MAX; checkIntervalNo++) {
				// eslint-disable-next-line no-loop-func
				setTimeout(() => {
					KEYS_DELETION_DELAY.forEach((deleteAtIntervalNo, key) => {
						if (deleteAtIntervalNo === checkIntervalNo) {
							try {
								expect(CACHE_ACTIVE_KEYS.has(key)).to.be.eq(false, `Expected key '${key}' to be deleted at interval ${deleteAtIntervalNo}`);

								const shouldBeIdle = CACHE_ACTIVE_KEYS.size === 0;
								const idleCheckMessage = `Policy expected to be ${
									shouldBeIdle ? `idle, but it has ${policy.size} keys` : `busy, because ${CACHE_ACTIVE_KEYS.size} active keys remained`
								} at interval ${deleteAtIntervalNo}`;
								expect(policy.isIdle()).to.be.eq(shouldBeIdle, idleCheckMessage);
							} catch (e) {
								logTestContext(checkIntervalNo);
								done(e);
							}
						}
					});

					if (checkIntervalNo === CHECK_INTERVAL_MAX) {
						try {
							if (CACHE_ACTIVE_KEYS.size !== 0) {
								throw new Error(`${CACHE_ACTIVE_KEYS.size} remained at the ${checkIntervalNo} check interval, expected 0`);
							}

							expect(policy.isIdle()).to.be.eq(true);
							expect(policy.size).to.be.eq(0);
							KEYS_DELETION_DELAY.clear();

							return done();
						} catch (e) {
							logTestContext();
							return done(e);
						}
					}

					return undefined;
				}, checkIntervalNo * 1000 + 100); // just in case system resources are more busy
			}

			const gcIntervalReTrackSchedulers = new Map<number, Array<() => void>>();

			for (let i = SCHEDULE_DELETION_MIN_DELAY; i <= SCHEDULE_DELETION_MAX_DELAY; i++) {
				gcIntervalReTrackSchedulers.set(i, []);
				setTimeout(() => {
					gcIntervalReTrackSchedulers.get(i)!.forEach((scheduleDeletion) => scheduleDeletion());
					gcIntervalReTrackSchedulers.delete(i);
				}, i * 1000);
			}

			const keyGenerator = new UniqueKeysGenerator(5);

			for (let i = 0; i < SCHEDULING_TIMES; i++) {
				const scheduleDeletionDelay = number.randomInt(SCHEDULE_DELETION_MIN_DELAY, SCHEDULE_DELETION_MAX_DELAY);

				gcIntervalReTrackSchedulers.get(scheduleDeletionDelay)!.push(() => {
					const key = keyGenerator.generate();
					const ttl = number.randomInt(MIN_TTL, MAX_TTL);

					KEYS_DELETION_DELAY.set(key, ttl + scheduleDeletionDelay);

					CACHE_ACTIVE_KEYS.add(key);
					policy.onUpdate(key, generateEntry(key), { expiresAfter: ttl });
				});
			}
		}).timeout(10_500);
	});

	describe(`${ProactiveExpirationPolicy.prototype.onGet.name.magenta} spec`, () => {
		it('does nothing on hit and returns entry as being valid, as it will be evicted later by timer', () => {
			const policy = new ProactiveExpirationPolicy<string, number>(gcFactory());
			const isValid = policy.onGet();
			expect(isValid).to.be.eq(EntryValidity.VALID);
		});
	});

	describe(`${ProactiveExpirationPolicy.prototype.onDelete.name.magenta} spec`, () => {
		it("does not remove keys that don't have expiration", () => {
			const policy = new ProactiveExpirationPolicy<string, any>(gcFactory());

			const entry = generateEntry('a');
			policy.onSet('a', entry, { expiresAfter: null! });
			expect(policy.size).to.be.eq(0);

			policy.onDelete('a', entry); // expecting to do nothing
			expect(policy.size).to.be.eq(0);
		});

		it('removes entry from internal tracking after it is deleted, while the rest entries are evicted', (done) => {
			const policy = new ProactiveExpirationPolicy<string, any>(gcFactory());
			const EVICTED_KEYS = new Set<string>();
			policy.setDeleter((evictedKey, evictedEntry) => {
				EVICTED_KEYS.add(evictedKey);
				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});

			const keyGenerator = new UniqueKeysGenerator(5);

			const ENTRIES_BY_TTL = new Map<number, ExpirableCacheEntryHeapNode<string, any>[]>([
				[1, array.filledWith(number.randomInt(0, 10), () => generateEntry(keyGenerator.generate()))],
				[2, array.filledWith(number.randomInt(0, 10), () => generateEntry(keyGenerator.generate()))],
				[3, array.filledWith(number.randomInt(0, 10), () => generateEntry(keyGenerator.generate()))]
			]);
			const REMOVAL_KEY_CANDIDATES = new Set<string>(
				Array.from(ENTRIES_BY_TTL.entries())
					.map(([, entries]) => {
						const candidates = [];
						for (let i = 0; i < entries.length; i++) {
							if (Math.random() > 0.6) {
								candidates.push(entries[i].key);
							}
						}
						return candidates;
					})
					.flat()
			);

			let totalEntries = 0;
			for (const [ttl, entries] of ENTRIES_BY_TTL) {
				if (!entries.length) {
					continue;
				}
				totalEntries += entries.length;

				for (const entry of entries) {
					policy.onSet(entry.key, entry, { expiresAfter: ttl });
				}

				setTimeout(() => {
					for (const entry of entries) {
						if (REMOVAL_KEY_CANDIDATES.has(entry.key)) {
							policy.onDelete(entry.key, entry);
						}
					}
				}, chrono.secondsToMilliseconds(ttl - 1));
			}
			expect(policy.size).to.be.eq(totalEntries);

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS.size).to.be.eq(totalEntries - REMOVAL_KEY_CANDIDATES.size); // evicted keys should not contain explicitly deleted ones
					for (const evictedKey of EVICTED_KEYS) {
						expect(REMOVAL_KEY_CANDIDATES.has(evictedKey)).to.be.eq(false, `Key ${evictedKey} should be evicted, not explicitly removed.`);
					}

					expect(policy.size).to.be.eq(0); // in the end, all of them were removed from policy...
					expect(policy.isIdle()).to.be.eq(true); // ... and gc should stop
					done();
				} catch (e) {
					done(e);
				}
			}, 3100);
		}).timeout(3200);
	});

	describe(`${ProactiveExpirationPolicy.prototype.onClear.name.magenta} spec`, () => {
		it('should clear empty policy and remain idle', () => {
			const policy = new ProactiveExpirationPolicy<string, any>(gcFactory());
			expect(policy.isIdle()).to.be.eq(true);
			policy.onClear();
			expect(policy.isIdle()).to.be.eq(true);
		});

		it('should clear policy, make it idle and avoid further evictions', (done) => {
			const policy = new ProactiveExpirationPolicy<string, any>(gcFactory());
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedKey, evictedEntry) => {
				EVICTED_KEYS.push(evictedKey);
				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});

			const TTL = 1;

			policy.onUpdate('a', generateEntry('a'), { expiresAfter: TTL });
			expect(policy.size).to.be.eq(1);
			expect(policy.isIdle()).to.be.eq(false);

			policy.onClear();
			expect(policy.size).to.be.eq(0);
			expect(policy.isIdle()).to.be.eq(true);
			expect(EVICTED_KEYS).to.be.ofSize(0);

			setTimeout(() => {
				try {
					expect(policy.size).to.be.eq(0);
					expect(policy.isIdle()).to.be.eq(true);
					expect(EVICTED_KEYS).to.be.ofSize(0); // key was not evicted because policy was cleared

					done();
				} catch (e) {
					done(e);
				}
			}, chrono.secondsToMilliseconds(TTL) + 100);
		});

		it('should clear policy, push new items, and old timer not interfere with their expiration', (done) => {
			const policy = new ProactiveExpirationPolicy<string, any>(gcFactory());
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedKey, evictedEntry) => {
				EVICTED_KEYS.push(evictedKey);
				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});

			policy.onUpdate('a', generateEntry('a'), { expiresAfter: 1 });
			expect(policy.size).to.be.eq(1);
			expect(policy.isIdle()).to.be.eq(false);

			policy.onClear();
			expect(policy.size).to.be.eq(0);
			expect(policy.isIdle()).to.be.eq(true);
			expect(EVICTED_KEYS).to.be.ofSize(0);

			policy.onUpdate('b', generateEntry('b'), { expiresAfter: 2 });
			expect(policy.size).to.be.eq(1);
			expect(policy.isIdle()).to.be.eq(false);

			// old timer should not interfere with key 'b' and delete it earlier
			setTimeout(() => {
				try {
					expect(policy.size).to.be.eq(1); // key 'b' is still here
					expect(policy.isIdle()).to.be.eq(false); // timer is active
					expect(EVICTED_KEYS).to.be.ofSize(0); // no keys evicted, i.e. the key 'a'
				} catch (e) {
					clearTimeout(checkKeyBEvictedTimeout);
					done(e);
				}
			}, 1100);

			// the new timer should delete key 'b' when it expires
			const checkKeyBEvictedTimeout = setTimeout(() => {
				try {
					expect(policy.size).to.be.eq(0); // key 'b' was evicted
					expect(policy.isIdle()).to.be.eq(true); // timer is inactive
					expect(EVICTED_KEYS).to.be.equalTo(['b']); // only key 'b' was evicted

					done();
				} catch (e) {
					done(e);
				}
			}, 2100);
		}).timeout(2500);
	});
});

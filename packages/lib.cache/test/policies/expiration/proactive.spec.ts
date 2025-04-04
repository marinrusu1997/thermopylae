import { logger } from '@thermopylae/dev.unit-test';
import { buildPromiseHolder } from '@thermopylae/lib.async';
import { chrono, types } from '@thermopylae/lib.utils';
import colors from 'colors';
import { convert } from 'convert';
import { randomInt } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import randomItem from 'random-item';
import { describe, expect, it } from 'vitest';
import { EXPIRES_AT_SYM, INFINITE_EXPIRATION } from '../../../lib/constants.js';
import { HEAP_NODE_IDX_SYM, type HeapNode } from '../../../lib/data-structures/heap.js';
import { BucketGarbageCollector, type GarbageCollector, HeapGarbageCollector, ProactiveExpirationPolicy } from '../../../lib/index.js';
import type { ExpirableCacheEntry } from '../../../lib/policies/expiration/abstract.js';
import type { ProactiveExpirableCacheEntry } from '../../../lib/policies/expiration/proactive.js';
import { type Deleter, EntryValidity } from '../../../lib/typings/cache-replacement-policy.js';
import { UniqueKeysGenerator } from '../../utils.js';

interface ExpirableCacheEntryHeapNode<Key, Value> extends ExpirableCacheEntry<Key, Value>, HeapNode {}

type ArrayElement<A> = A extends readonly (infer T)[] ? T : never;

function generateEntry<K, V extends ArrayElement<typeof generateEntry.VALUES>>(key: K): ExpirableCacheEntryHeapNode<K, V> {
	return {
		key,
		value: randomItem(generateEntry.VALUES) as types.Any,
		[EXPIRES_AT_SYM]: undefined,
		[HEAP_NODE_IDX_SYM]: types.SOFT_DELETE // it does need to be here initially when entry is created
	};
}
generateEntry.VALUES = [undefined, null, false as boolean, 0 as number, '' as string, {}, []] as const;

function gcFactory<K, V>(): GarbageCollector<ProactiveExpirableCacheEntry<K, V>> {
	return Math.random() >= 0.5
		? new HeapGarbageCollector<ProactiveExpirableCacheEntry<K, V>>()
		: new BucketGarbageCollector<ProactiveExpirableCacheEntry<K, V>>();
}

describe(`${colors.magenta(ProactiveExpirationPolicy.name)} spec`, () => {
	const defaultTTL = 1; // second
	describe(`${ProactiveExpirationPolicy.prototype.onSet.name.magenta} spec`, () => {
		it('does not evict item if it has infinite or no ttl', async () => {
			const policy = new ProactiveExpirationPolicy<string, number>(gcFactory());
			const EVICTED_KEYS = new Array<string>();
			const MAX_TIMEOUT = 1000;
			const TIMEOUT_STEP = 100;

			const deferred = buildPromiseHolder<void>();

			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);

				const expirableCacheHeapNode = evictedEntry as ExpirableCacheEntryHeapNode<string, number>;
				policy.onDelete(expirableCacheHeapNode);
				expect(expirableCacheHeapNode[EXPIRES_AT_SYM]).toBeUndefined();
				expect(expirableCacheHeapNode[HEAP_NODE_IDX_SYM]).toBeUndefined();
			});

			for (let timeout = TIMEOUT_STEP; timeout <= MAX_TIMEOUT; timeout += TIMEOUT_STEP) {
				setTimeout(() => {
					expect(EVICTED_KEYS).to.have.length(0);
					expect(policy.size).to.be.eq(0); // it didn't tracks nothing
					if (timeout === MAX_TIMEOUT) {
						deferred.resolve();
					}
				}, timeout);
			}

			policy.onSet(generateEntry('a'), { expiresAfter: INFINITE_EXPIRATION });
			policy.onSet(generateEntry('b'), { expiresAfter: undefined });
			policy.onSet(generateEntry('c'), { expiresAfter: null as types.Any });

			expect(policy.size).to.be.eq(0); // it didn't tracks nothing

			await deferred.promise;
		});

		it('evicts expired item', async () => {
			expect.hasAssertions();

			const policy = new ProactiveExpirationPolicy<string, unknown>(gcFactory());

			const TRACKED_KEY = 'key';
			const WHEN_TRACKING_BEGAN = chrono.unix();

			const deferred = buildPromiseHolder<void>();

			const deleter: Deleter<string, unknown> = (evictedEntry) => {
				expect(chrono.unix() - WHEN_TRACKING_BEGAN).to.be.equals(defaultTTL);
				expect(evictedEntry.key).to.be.equals(TRACKED_KEY);

				policy.onDelete(evictedEntry as ExpirableCacheEntryHeapNode<string, number>);

				expect(policy.size).to.be.eq(0);
				deferred.resolve();
			};

			policy.setDeleter(deleter);
			policy.onSet(generateEntry(TRACKED_KEY), { expiresAfter: defaultTTL });

			await deferred.promise;
		});

		it('should not allow inserting of items which have ttl in milliseconds', () => {
			const policy = new ProactiveExpirationPolicy<string, unknown>(gcFactory());

			expect(() => policy.onSet(generateEntry('a'), { expiresAfter: 0.1 })).to.throw(`'expiresAfter' needs to be an integer. Given: ${0.1}.`);
			expect(() => policy.onSet(generateEntry('a'), { expiresAfter: 1, expiresFrom: 0.1 })).to.throw(
				`'expiresFrom' needs to be an integer. Given: ${0.1}.`
			);
		});

		it('evicts multiple expired keys with same ttl (tracking started at same time)', async () => {
			expect.hasAssertions();

			const policy = new ProactiveExpirationPolicy<string, unknown>(gcFactory());

			const trackedKeys = ['key1', 'key2', 'key3'];
			const whenTrackingBegan = chrono.unix();

			const deferred = buildPromiseHolder<void>();

			const deleter: Deleter<string, unknown> = (evictedEntry) => {
				expect(chrono.unix() - whenTrackingBegan).to.be.equals(defaultTTL);
				expect(trackedKeys).to.contain(evictedEntry.key);
				trackedKeys.splice(trackedKeys.indexOf(evictedEntry.key), 1); // ensure not called with same key

				policy.onDelete(evictedEntry as ExpirableCacheEntryHeapNode<string, number>);

				if (trackedKeys.length === 0) {
					process.nextTick(() => {
						expect(policy.size).to.be.eq(0);
						deferred.resolve();
					});
				}
			};

			policy.setDeleter(deleter);
			for (const key of trackedKeys) {
				policy.onSet(generateEntry(key), { expiresAfter: defaultTTL });
			}

			await deferred.promise;
		});

		it('evicts multiple expired keys with different ttl (tracking started at same time)', { timeout: 2500 }, async () => {
			expect.hasAssertions();

			const policy = new ProactiveExpirationPolicy<string, unknown>(gcFactory());

			const trackedKeysMap = new Map<string, number>();
			trackedKeysMap.set('key1', defaultTTL);
			trackedKeysMap.set('key2', defaultTTL);
			trackedKeysMap.set('key3', defaultTTL + 1);
			trackedKeysMap.set('key4', defaultTTL + 1);

			const whenTrackingBegan = chrono.unix();

			const deferred = buildPromiseHolder<void>();
			const deleter: Deleter<string, unknown> = (evictedEntry) => {
				expect(chrono.unix() - whenTrackingBegan).to.be.equals(trackedKeysMap.get(evictedEntry.key));
				expect([...trackedKeysMap.keys()]).to.contain(evictedEntry.key);
				trackedKeysMap.delete(evictedEntry.key); // ensure not called with same key

				policy.onDelete(evictedEntry as ExpirableCacheEntryHeapNode<string, number>);

				if (trackedKeysMap.size === 0) {
					deferred.resolve();
				}
			};

			policy.setDeleter(deleter);
			for (const [key, ttl] of trackedKeysMap) {
				policy.onSet(generateEntry(key), { expiresAfter: ttl });
			}

			await deferred.promise;
		});

		it(
			'evicts multiple expired keys with different ttl in the order keys were tracked (tracking stared at different times)',
			{ timeout: 4100 },
			async () => {
				const policy = new ProactiveExpirationPolicy<string, unknown>(gcFactory());
				const KEYS_TO_BE_TRACKED = 4;

				const trackedKeysMap = new Map<string, { trackingSince: number; ttl: number }>();
				const trackedKeysSnapshot = ['key1', 'key2', 'key3', 'key4'];

				let currentNumberOfRemovedKeys = 0;

				const deferred = buildPromiseHolder<void>();

				policy.setDeleter((evictedEntry) => {
					policy.onDelete(evictedEntry as ExpirableCacheEntryHeapNode<string, number>);

					const trackingInfo = trackedKeysMap.get(evictedEntry.key);
					if (!trackingInfo) {
						throw new Error(`No tracking info for key '${evictedEntry.key}'`);
					}

					expect(chrono.unix() - trackingInfo.trackingSince).to.be.equals(trackingInfo.ttl);
					expect([...trackedKeysMap.keys()]).to.contain(evictedEntry.key);

					trackedKeysMap.delete(evictedEntry.key); // ensure not called with same key

					expect(trackedKeysSnapshot[currentNumberOfRemovedKeys]).to.be.equal(evictedEntry.key);

					currentNumberOfRemovedKeys += 1;
					if (currentNumberOfRemovedKeys === KEYS_TO_BE_TRACKED) {
						deferred.resolve();
					}
				});

				trackedKeysMap.set('key1', { trackingSince: chrono.unix(), ttl: defaultTTL });
				policy.onSet(generateEntry('key1'), { expiresAfter: defaultTTL });

				setTimeout(() => {
					trackedKeysMap.set('key2', { trackingSince: chrono.unix(), ttl: defaultTTL });
					policy.onSet(generateEntry('key2'), { expiresAfter: defaultTTL });
				}, 1000);

				setTimeout(() => {
					trackedKeysMap.set('key3', { trackingSince: chrono.unix(), ttl: defaultTTL });
					policy.onSet(generateEntry('key3'), { expiresAfter: defaultTTL });
				}, 2000);

				setTimeout(() => {
					trackedKeysMap.set('key4', { trackingSince: chrono.unix(), ttl: defaultTTL });
					policy.onSet(generateEntry('key4'), { expiresAfter: defaultTTL });
				}, 3000);

				await deferred.promise;
			}
		);

		it('evicts duplicate keys with same ttl', async () => {
			const policy = new ProactiveExpirationPolicy<string, unknown>(gcFactory());

			const trackedKeys = ['key', 'key', 'key'];
			const whenTrackingBegan = chrono.unix();

			const deferred = buildPromiseHolder<void>();

			policy.setDeleter((evictedEntry) => {
				policy.onDelete(evictedEntry as ExpirableCacheEntryHeapNode<string, number>);

				expect(chrono.unix() - whenTrackingBegan).to.be.equals(defaultTTL);
				expect(trackedKeys).to.contain(evictedEntry.key);

				trackedKeys.splice(trackedKeys.indexOf(evictedEntry.key), 1); // ensure not called with same key
				if (trackedKeys.length === 0) {
					deferred.resolve();
				}
			});
			for (const key of trackedKeys) {
				policy.onSet(generateEntry(key), { expiresAfter: defaultTTL });
			}

			await deferred.promise;
		});

		it('restarts gc after all tracked keys were evicted', { timeout: 3600 }, async () => {
			const policy = new ProactiveExpirationPolicy<string, unknown>(gcFactory());

			const trackedKeys = ['key1', 'key2'];
			let whenTrackingBegan = 0;

			const trackKey = (key: string): void => {
				policy.onSet(generateEntry(key), { expiresAfter: defaultTTL });
				whenTrackingBegan = chrono.unix();
			};

			const deferred = buildPromiseHolder<void>();

			policy.setDeleter((evictedEntry) => {
				policy.onDelete(evictedEntry as ExpirableCacheEntryHeapNode<string, number>);

				expect(chrono.unix() - whenTrackingBegan).to.be.eq(defaultTTL);
				expect(trackedKeys).to.contain(evictedEntry.key);
				trackedKeys.splice(trackedKeys.indexOf(evictedEntry.key), 1); // ensure not called with same key

				if (trackedKeys.length === 0) {
					deferred.resolve();
				}
			});

			trackKey('key1');

			setTimeout(() => trackKey('key2'), (defaultTTL + 1.5) * 1000);
			await deferred.promise;
		});

		it('restarts the gc after it was stopped, discarding and its internal list of tracked keys', { timeout: 2600 }, async () => {
			const policy = new ProactiveExpirationPolicy<string, number>(gcFactory());

			const trackedKeyBeforeStopping = 'key1';
			const trackedKeyAfterStopping = 'key2';
			let whenTrackingBegan = 0;

			const trackKey = (key: string): void => {
				policy.onSet(generateEntry(key), { expiresAfter: defaultTTL });
				whenTrackingBegan = chrono.unix();
			};

			const deferred = buildPromiseHolder<void>();

			policy.setDeleter((evictedEntry) => {
				policy.onDelete(evictedEntry as ExpirableCacheEntryHeapNode<string, number>);

				expect(chrono.unix() - whenTrackingBegan).to.be.equals(defaultTTL);
				expect(trackedKeyAfterStopping).to.be.equal(evictedEntry.key);

				deferred.resolve();
			});

			trackKey(trackedKeyBeforeStopping);
			policy.onClear();
			setTimeout(() => trackKey(trackedKeyAfterStopping), 1500);

			await deferred.promise;
		});

		it('is synchronized with nearest element to remove while adding keys', { timeout: 7000 }, async () => {
			const policy = new ProactiveExpirationPolicy<string, unknown>(gcFactory());
			const keys = new Set<string>();

			policy.setDeleter((evictedEntry) => {
				keys.delete(evictedEntry.key);
				policy.onDelete(evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});
			expect(policy.isIdle()).to.be.eq(true);

			// adding element with same ttl
			keys.add('key1');
			policy.onSet(generateEntry('key1'), { expiresAfter: 1 });
			expect(policy.isIdle()).to.be.eq(false);
			expect(policy.size).to.be.eq(1);

			keys.add('key2');
			policy.onSet(generateEntry('key2'), { expiresAfter: 1 });
			expect(policy.size).to.be.eq(2);

			await sleep(1100);
			expect(keys.size).to.be.eq(0);
			expect(policy.size).to.be.eq(0);
			expect(policy.isIdle()).to.be.eq(true);

			// adding element with greater ttl
			keys.add('key1');
			policy.onSet(generateEntry('key1'), { expiresAfter: 1 });
			expect(policy.isIdle()).to.be.eq(false);
			expect(policy.size).to.be.eq(1);

			keys.add('key2');
			policy.onSet(generateEntry('key2'), { expiresAfter: 2 });
			expect(policy.size).to.be.eq(2);

			await sleep(1100);
			expect(keys.size).to.be.eq(1);
			expect(policy.size).to.be.eq(1);
			expect(keys.has('key1')).to.be.eq(false);
			expect(policy.isIdle()).to.be.eq(false);

			await sleep(1100);
			expect(keys.size).to.be.eq(0);
			expect(policy.size).to.be.eq(0);
			expect(policy.isIdle()).to.be.eq(true);

			// adding element smaller
			keys.add('key1');
			policy.onSet(generateEntry('key1'), { expiresAfter: 2 });
			expect(policy.isIdle()).to.be.eq(false);
			expect(policy.size).to.be.eq(1);

			keys.add('key2');
			policy.onSet(generateEntry('key2'), { expiresAfter: 1 });
			expect(policy.size).to.be.eq(2);

			await sleep(1100);
			expect(keys.size).to.be.eq(1);
			expect(policy.size).to.be.eq(1);
			expect(keys.has('key2')).to.be.eq(false);
			expect(policy.isIdle()).to.be.eq(false);

			await sleep(1100);
			expect(keys.size).to.be.eq(0);
			expect(policy.size).to.be.eq(0);
			expect(policy.isIdle()).to.be.eq(true);
		});
	});

	describe(`${ProactiveExpirationPolicy.prototype.onUpdate.name.magenta} spec`, () => {
		it('evicts key sooner if ttl decreased (ttl reported to same expiresFrom)', async () => {
			expect.hasAssertions();

			const policy = new ProactiveExpirationPolicy<string, number>(gcFactory());
			const EVICTED_KEYS = new Array<string>();
			const KEY = 'a';
			const ENTRY: ExpirableCacheEntryHeapNode<string, number> = generateEntry(KEY);
			const OLD_TTL = 2;
			const NEW_TTL = 1;
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);
				policy.onDelete(evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});

			const deferred = buildPromiseHolder<void>();
			setTimeout(
				() => {
					try {
						expect(EVICTED_KEYS).to.have.length(1);
						expect(EVICTED_KEYS).to.contain(KEY);
						expect(policy.size).to.be.eq(0);
						expect(policy.isIdle()).to.be.eq(true);
						deferred.resolve();
					} catch (error) {
						deferred.reject(error);
					}
				},
				convert(NEW_TTL, 's').to('ms') + 30
			);

			const expiresFrom = chrono.unix();
			policy.onSet(ENTRY, { expiresAfter: OLD_TTL, expiresFrom });
			policy.onUpdate(ENTRY, { expiresAfter: NEW_TTL, expiresFrom });

			await deferred.promise;
		});

		it('evicts key later if ttl increased (ttl reported to same expiresFrom)', { timeout: 2500 }, async () => {
			expect.hasAssertions();

			const policy = new ProactiveExpirationPolicy<string, number>(gcFactory());
			const EVICTED_KEYS = new Array<string>();
			const KEY = 'a';
			const ENTRY: ExpirableCacheEntryHeapNode<string, number> = generateEntry(KEY);
			const OLD_TTL = 1;
			const NEW_TTL = 2;
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);
				policy.onDelete(evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});

			const deferred = buildPromiseHolder<void>();
			setTimeout(
				() => {
					try {
						expect(EVICTED_KEYS).to.have.length(0);
						expect(policy.size).to.be.eq(1);
						expect(policy.isIdle()).to.be.eq(false);
					} catch (error) {
						clearTimeout(newTtlSetTimeout);
						deferred.reject(error);
					}
				},
				convert(OLD_TTL, 's').to('ms') + 30
			);

			const newTtlSetTimeout = setTimeout(
				() => {
					try {
						expect(EVICTED_KEYS).to.have.length(1);
						expect(EVICTED_KEYS).to.contain(KEY);
						expect(policy.size).to.be.eq(0);
						expect(policy.isIdle()).to.be.eq(true);
						deferred.resolve();
					} catch (error) {
						deferred.reject(error);
					}
				},
				convert(NEW_TTL, 's').to('ms') + 30
			);

			const expiresFrom = chrono.unix();
			policy.onSet(ENTRY, { expiresAfter: OLD_TTL, expiresFrom });
			policy.onUpdate(ENTRY, { expiresAfter: NEW_TTL, expiresFrom });

			await deferred.promise;
		});

		it('evicts key later if ttl is the same (ttl reported to expiresFrom equal to current timestamp)', { timeout: 2500 }, async () => {
			expect.hasAssertions();

			const policy = new ProactiveExpirationPolicy<string, number>(gcFactory());
			const EVICTED_KEYS = new Array<string>();
			const KEY = 'a';
			const ENTRY: ExpirableCacheEntryHeapNode<string, number> = generateEntry(KEY);
			const OLD_TTL = 1;
			const NEW_TTL = 1;
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);
				policy.onDelete(evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});

			const deferred = buildPromiseHolder<void>();
			setTimeout(
				() => {
					try {
						expect(EVICTED_KEYS).to.have.length(0);
						expect(policy.size).to.be.eq(1);
						expect(policy.isIdle()).to.be.eq(false);
					} catch (error) {
						clearTimeout(newTtlSetTimeout);
						deferred.reject(error);
					}
				},
				convert(OLD_TTL, 's').to('ms') + 30
			);

			const newTtlSetTimeout = setTimeout(
				() => {
					try {
						expect(EVICTED_KEYS).to.have.length(1);
						expect(EVICTED_KEYS).to.contain(KEY);
						expect(policy.size).to.be.eq(0);
						expect(policy.isIdle()).to.be.eq(true);
						deferred.resolve();
					} catch (error) {
						deferred.reject(error);
					}
				},
				convert(NEW_TTL + OLD_TTL, 's').to('ms') + 30
			); // schedule later

			const expiresFrom = chrono.unix();
			policy.onSet(ENTRY, { expiresAfter: OLD_TTL, expiresFrom });
			policy.onUpdate(ENTRY, { expiresAfter: NEW_TTL, expiresFrom: expiresFrom + 1 }); // schedule later

			await deferred.promise;
		});

		it(
			"evicts key at it's previous timestamp if new ttl + expiresFrom will have the same eviction timestamp as the latest one",
			{ timeout: 2500 },
			async () => {
				expect.hasAssertions();

				const policy = new ProactiveExpirationPolicy<string, number>(gcFactory());
				const EVICTED_KEYS = new Array<string>();
				const KEY = 'a';
				const ENTRY: ExpirableCacheEntryHeapNode<string, number> = generateEntry(KEY);
				const OLD_TTL = 2;
				const NEW_TTL = 1;
				policy.setDeleter((evictedEntry) => {
					EVICTED_KEYS.push(evictedEntry.key);
					policy.onDelete(evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
				});

				const deferred = buildPromiseHolder<void>();
				setTimeout(
					() => {
						try {
							expect(EVICTED_KEYS).to.have.length(1);
							expect(EVICTED_KEYS).to.contain(KEY);
							expect(policy.size).to.be.eq(0);
							expect(policy.isIdle()).to.be.eq(true);
							deferred.resolve();
						} catch (error) {
							deferred.reject(error);
						}
					},
					convert(OLD_TTL, 's').to('ms') + 30
				); // NEW_TTL will have the same impact

				policy.onSet(ENTRY, { expiresAfter: OLD_TTL });

				setTimeout(() => {
					policy.onUpdate(ENTRY, { expiresAfter: NEW_TTL }); // generates same eviction timestamp
				}, convert(NEW_TTL, 's').to('ms'));

				await deferred.promise;
			}
		);

		it('does not evict key if it had tll, but the new one is infinite', async () => {
			expect.hasAssertions();

			const policy = new ProactiveExpirationPolicy<string, number>(gcFactory());
			const EVICTED_KEYS = new Array<string>();
			const KEY = 'a';
			const ENTRY: ExpirableCacheEntryHeapNode<string, number> = generateEntry(KEY);
			const OLD_TTL = 1;
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);
				policy.onDelete(evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});

			const deferred = buildPromiseHolder<void>();
			setTimeout(
				() => {
					try {
						expect(EVICTED_KEYS).to.have.length(0);
						expect(policy.size).to.be.eq(0); // does not track it
						expect(policy.isIdle()).to.be.eq(true);
						deferred.resolve();
					} catch (error) {
						deferred.reject(error);
					}
				},
				convert(OLD_TTL, 's').to('ms') + 50
			);

			const expiresFrom = chrono.unix();
			policy.onSet(ENTRY, { expiresAfter: OLD_TTL, expiresFrom });

			setTimeout(() => {
				policy.onUpdate(ENTRY, { expiresAfter: INFINITE_EXPIRATION });
			}, 500);

			await deferred.promise;
		});

		it("evicts the key if it didn't had tll, and the new ttl is specified", async () => {
			expect.hasAssertions();

			const policy = new ProactiveExpirationPolicy<string, number>(gcFactory());
			const EVICTED_KEYS = new Array<string>();
			const KEY = 'a';
			const ENTRY: ExpirableCacheEntryHeapNode<string, number> = generateEntry(KEY);
			const NEW_TTL = 1;
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);
				policy.onDelete(evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});

			policy.onSet(ENTRY);
			policy.onUpdate(ENTRY, { expiresAfter: NEW_TTL });

			const deferred = buildPromiseHolder<void>();
			setTimeout(
				() => {
					try {
						expect(EVICTED_KEYS).to.have.length(1);
						expect(EVICTED_KEYS).to.contain(KEY);
						expect(policy.size).to.be.eq(0);
						expect(policy.isIdle()).to.be.eq(true);
						deferred.resolve();
					} catch (error) {
						deferred.reject(error);
					}
				},
				convert(NEW_TTL, 's').to('ms') + 50
			);

			await deferred.promise;
		});

		it('should do nothing when options or ttl is not given', async () => {
			const policy = new ProactiveExpirationPolicy<string, number>(gcFactory());
			const EVICTED_KEYS = new Array<string>();
			const KEY = 'a';
			const ENTRY: ExpirableCacheEntryHeapNode<string, number> = generateEntry(KEY);
			const NEW_TTL = 1;
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);
				policy.onDelete(evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});

			policy.onUpdate(ENTRY, { expiresAfter: NEW_TTL });

			policy.onUpdate(ENTRY); // does nothing
			expect(EVICTED_KEYS).to.have.length(0);
			policy.onUpdate(ENTRY, { expiresAfter: undefined }); // does nothing
			expect(EVICTED_KEYS).to.have.length(0);
			policy.onUpdate(ENTRY, { expiresAfter: null as types.Any }); // does nothing
			expect(EVICTED_KEYS).to.have.length(0);

			const deferred = buildPromiseHolder<void>();
			setTimeout(
				() => {
					try {
						expect(EVICTED_KEYS).to.have.length(1);
						expect(EVICTED_KEYS).to.contain(KEY);
						expect(policy.size).to.be.eq(0);
						expect(policy.isIdle()).to.be.eq(true);
						deferred.resolve();
					} catch (error) {
						deferred.reject(error);
					}
				},
				convert(NEW_TTL, 's').to('ms') + 50
			);

			await deferred.promise;
		});

		it("does not evict key if it didn't had ttl, and the new ttl is infinite", async () => {
			expect.hasAssertions();

			const policy = new ProactiveExpirationPolicy<string, number>(gcFactory());
			const EVICTED_KEYS = new Array<string>();
			const KEY = 'a';
			const ENTRY: ExpirableCacheEntryHeapNode<string, number> = generateEntry(KEY);
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);
				policy.onDelete(evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});

			policy.onSet(ENTRY, { expiresAfter: undefined });
			setTimeout(() => {
				policy.onUpdate(ENTRY, { expiresAfter: INFINITE_EXPIRATION });
			}, 500);

			const deferred = buildPromiseHolder<void>();

			let checkAttempts = 0;
			const intervalId = setInterval(() => {
				try {
					expect(EVICTED_KEYS).to.have.length(0);
					expect(policy.size).to.be.eq(0); // does not track
					expect(policy.isIdle()).to.be.eq(true);

					if (++checkAttempts >= 10) {
						clearInterval(intervalId);
						deferred.resolve();
					}
				} catch (error) {
					clearInterval(intervalId);
					deferred.reject(error);
				}
			}, 100);

			await deferred.promise;
		});

		it('is synchronized with nearest element to remove while adding/updating keys', { timeout: 10_500 }, async () => {
			const policy = new ProactiveExpirationPolicy<string, unknown>(gcFactory());
			const CACHE_ACTIVE_KEYS = new Set<string>();

			policy.setDeleter((evictedEntry) => {
				CACHE_ACTIVE_KEYS.delete(evictedEntry.key);
				policy.onDelete(evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
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

				logger.info(message.join('\n'));
			}

			const deferred = buildPromiseHolder<void>();

			for (let checkIntervalNo = CHECK_INTERVAL_MIN; checkIntervalNo <= CHECK_INTERVAL_MAX; checkIntervalNo++) {
				setTimeout(
					() => {
						for (const [key, deleteAtIntervalNo] of KEYS_DELETION_DELAY) {
							if (deleteAtIntervalNo === checkIntervalNo) {
								try {
									expect(CACHE_ACTIVE_KEYS.has(key)).to.be.eq(false, `Expected key '${key}' to be deleted at interval ${deleteAtIntervalNo}`);

									const shouldBeIdle = CACHE_ACTIVE_KEYS.size === 0;
									const idleCheckMessage = `Policy expected to be ${
										shouldBeIdle ? `idle, but it has ${policy.size} keys` : `busy, because ${CACHE_ACTIVE_KEYS.size} active keys remained`
									} at interval ${deleteAtIntervalNo}`;
									expect(policy.isIdle()).to.be.eq(shouldBeIdle, idleCheckMessage);
								} catch (error) {
									logTestContext(checkIntervalNo);
									deferred.reject(error);
								}
							}
						}

						if (checkIntervalNo === CHECK_INTERVAL_MAX) {
							try {
								if (CACHE_ACTIVE_KEYS.size > 0) {
									throw new Error(`${CACHE_ACTIVE_KEYS.size} remained at the ${checkIntervalNo} check interval, expected 0`);
								}

								expect(policy.isIdle()).to.be.eq(true);
								expect(policy.size).to.be.eq(0);
								KEYS_DELETION_DELAY.clear();

								return deferred.resolve();
							} catch (error) {
								logTestContext();
								return deferred.reject(error);
							}
						}

						return;
					},
					checkIntervalNo * 1000 + 100
				); // just in case system resources are more busy
			}

			const gcIntervalReTrackSchedulers = new Map<number, Array<() => void>>();

			for (let i = SCHEDULE_DELETION_MIN_DELAY; i <= SCHEDULE_DELETION_MAX_DELAY; i++) {
				gcIntervalReTrackSchedulers.set(i, []);
				setTimeout(() => {
					const scheduleDeletionHandlers = gcIntervalReTrackSchedulers.get(i);
					if (!scheduleDeletionHandlers) {
						throw new Error(`No schedule deletion handlers for index '${i}'`);
					}
					for (const scheduleDeletion of scheduleDeletionHandlers) {
						scheduleDeletion();
					}
					gcIntervalReTrackSchedulers.delete(i);
				}, i * 1000);
			}

			const keyGenerator = new UniqueKeysGenerator();

			for (let i = 0; i < SCHEDULING_TIMES; i++) {
				const scheduleDeletionDelay = randomInt(SCHEDULE_DELETION_MIN_DELAY, SCHEDULE_DELETION_MAX_DELAY);
				const deleters = gcIntervalReTrackSchedulers.get(scheduleDeletionDelay);
				if (!deleters) {
					throw new Error(`No deletes for schedule deletion delay '${scheduleDeletionDelay}'`);
				}

				deleters.push(() => {
					const key = keyGenerator.generate();
					const ttl = randomInt(MIN_TTL, MAX_TTL);

					KEYS_DELETION_DELAY.set(key, ttl + scheduleDeletionDelay);

					CACHE_ACTIVE_KEYS.add(key);
					policy.onUpdate(generateEntry(key), { expiresAfter: ttl });
				});
			}

			await deferred.promise;
		});
	});

	describe(`${ProactiveExpirationPolicy.prototype.onHit.name.magenta} spec`, () => {
		it('does nothing on hit and returns entry as being valid, as it will be evicted later by timer', () => {
			const policy = new ProactiveExpirationPolicy<string, number>(gcFactory());
			const isValid = policy.onHit();
			expect(isValid).to.be.eq(EntryValidity.VALID);
		});
	});

	describe(`${ProactiveExpirationPolicy.prototype.onDelete.name.magenta} spec`, () => {
		it("does not remove keys that don't have expiration", () => {
			const policy = new ProactiveExpirationPolicy<string, unknown>(gcFactory());

			const entry = generateEntry('a');
			policy.onSet(entry, { expiresAfter: null as types.Any });
			expect(policy.size).to.be.eq(0);

			policy.onDelete(entry); // expecting to do nothing
			expect(policy.size).to.be.eq(0);
		});

		it('removes entry from internal tracking after it is deleted, while the rest entries are evicted', { timeout: 3200 }, async () => {
			const policy = new ProactiveExpirationPolicy<string, unknown>(gcFactory());
			const EVICTED_KEYS = new Set<string>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.add(evictedEntry.key);
				policy.onDelete(evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});

			const keyGenerator = new UniqueKeysGenerator();

			const ENTRIES_BY_TTL = new Map<number, ExpirableCacheEntryHeapNode<string, unknown>[]>([
				[1, Array.from({ length: randomInt(0, 10) }, () => generateEntry(keyGenerator.generate()))],
				[2, Array.from({ length: randomInt(0, 10) }, () => generateEntry(keyGenerator.generate()))],
				[3, Array.from({ length: randomInt(0, 10) }, () => generateEntry(keyGenerator.generate()))]
			]);
			const REMOVAL_KEY_CANDIDATES = new Set<string>(
				[...ENTRIES_BY_TTL.entries()].flatMap(([, entries]) => {
					const candidates = [];
					for (const entry of entries) {
						if (Math.random() > 0.6) {
							candidates.push(entry.key);
						}
					}
					return candidates;
				})
			);

			let totalEntries = 0;
			for (const [ttl, entries] of ENTRIES_BY_TTL) {
				if (entries.length === 0) {
					continue;
				}
				totalEntries += entries.length;

				for (const entry of entries) {
					policy.onSet(entry, { expiresAfter: ttl });
				}

				setTimeout(
					() => {
						for (const entry of entries) {
							if (REMOVAL_KEY_CANDIDATES.has(entry.key)) {
								policy.onDelete(entry);
							}
						}
					},
					convert(ttl - 1, 's').to('ms')
				);
			}
			expect(policy.size).to.be.eq(totalEntries);

			const deferred = buildPromiseHolder<void>();
			setTimeout(() => {
				try {
					expect(EVICTED_KEYS.size).to.be.eq(totalEntries - REMOVAL_KEY_CANDIDATES.size); // evicted keys should not contain explicitly deleted ones
					for (const evictedKey of EVICTED_KEYS) {
						expect(REMOVAL_KEY_CANDIDATES.has(evictedKey)).to.be.eq(false, `Key ${evictedKey} should be evicted, not explicitly removed.`);
					}

					expect(policy.size).to.be.eq(0); // in the end, all of them were removed from policy...
					expect(policy.isIdle()).to.be.eq(true); // ... and gc should stop
					deferred.resolve();
				} catch (error) {
					deferred.reject(error);
				}
			}, 3100);

			await deferred.promise;
		});
	});

	describe(`${ProactiveExpirationPolicy.prototype.onClear.name.magenta} spec`, () => {
		it('should clear empty policy and remain idle', () => {
			const policy = new ProactiveExpirationPolicy<string, unknown>(gcFactory());
			expect(policy.isIdle()).to.be.eq(true);
			policy.onClear();
			expect(policy.isIdle()).to.be.eq(true);
		});

		it('should clear policy, make it idle and avoid further evictions', async () => {
			const policy = new ProactiveExpirationPolicy<string, unknown>(gcFactory());
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);
				policy.onDelete(evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});

			const TTL = 1;

			policy.onUpdate(generateEntry('a'), { expiresAfter: TTL });
			expect(policy.size).to.be.eq(1);
			expect(policy.isIdle()).to.be.eq(false);

			policy.onClear();
			expect(policy.size).to.be.eq(0);
			expect(policy.isIdle()).to.be.eq(true);
			expect(EVICTED_KEYS).to.have.length(0);

			const deferred = buildPromiseHolder<void>();
			setTimeout(
				() => {
					try {
						expect(policy.size).to.be.eq(0);
						expect(policy.isIdle()).to.be.eq(true);
						expect(EVICTED_KEYS).to.have.length(0); // key was not evicted because policy was cleared

						deferred.resolve();
					} catch (error) {
						deferred.reject(error);
					}
				},
				convert(TTL, 's').to('ms') + 100
			);

			await deferred.promise;
		});

		it('should clear policy, push new items, and old timer not interfere with their expiration', { timeout: 2500 }, async () => {
			const policy = new ProactiveExpirationPolicy<string, unknown>(gcFactory());
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);
				policy.onDelete(evictedEntry as ExpirableCacheEntryHeapNode<string, number>);
			});

			policy.onUpdate(generateEntry('a'), { expiresAfter: 1 });
			expect(policy.size).to.be.eq(1);
			expect(policy.isIdle()).to.be.eq(false);

			policy.onClear();
			expect(policy.size).to.be.eq(0);
			expect(policy.isIdle()).to.be.eq(true);
			expect(EVICTED_KEYS).to.have.length(0);

			policy.onUpdate(generateEntry('b'), { expiresAfter: 2 });
			expect(policy.size).to.be.eq(1);
			expect(policy.isIdle()).to.be.eq(false);

			const deferred = buildPromiseHolder<void>();
			// old timer should not interfere with key 'b' and delete it earlier
			setTimeout(() => {
				try {
					expect(policy.size).to.be.eq(1); // key 'b' is still here
					expect(policy.isIdle()).to.be.eq(false); // timer is active
					expect(EVICTED_KEYS).to.have.length(0); // no keys evicted, i.e. the key 'a'
				} catch (error) {
					clearTimeout(checkKeyBEvictedTimeout);
					deferred.reject(error);
				}
			}, 1100);

			// the new timer should delete key 'b' when it expires
			const checkKeyBEvictedTimeout = setTimeout(() => {
				try {
					expect(policy.size).to.be.eq(0); // key 'b' was evicted
					expect(policy.isIdle()).to.be.eq(true); // timer is inactive
					expect(EVICTED_KEYS).toStrictEqual(['b']); // only key 'b' was evicted

					deferred.resolve();
				} catch (error) {
					deferred.reject(error);
				}
			}, 2100);

			await deferred.promise;
		});
	});
});

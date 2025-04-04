import { buildPromiseHolder } from '@thermopylae/lib.async';
import { array, types } from '@thermopylae/lib.utils';
import colors from 'colors';
import { convert } from 'convert';
import freeze from 'deep-freeze-es6';
import chunk from 'lodash.chunk';
import { randomInt } from 'node:crypto';
import randomItem from 'random-item';
import { describe, expect, it } from 'vitest';
import { EXPIRES_AT_SYM, INFINITE_EXPIRATION } from '../../../lib/constants.js';
import { HEAP_NODE_IDX_SYM } from '../../../lib/data-structures/heap.js';
import type { HeapExpirableEntry } from '../../../lib/garbage-collectors/heap-gc.js';
import { BucketGarbageCollector, EntryValidity, type GarbageCollector, HeapGarbageCollector } from '../../../lib/index.js';
import { type ExpirableSlidingCacheEntry, SlidingProactiveExpirationPolicy, TIME_SPAN_SYM } from '../../../lib/policies/expiration/sliding.js';

interface ExpirableSlidingCacheHeapEntry<K, V> extends ExpirableSlidingCacheEntry<K, V>, HeapExpirableEntry {}

function generateEntry<K, V extends (typeof generateEntry.VALUES)[0]>(key: K): ExpirableSlidingCacheHeapEntry<K, V> {
	return {
		key,
		value: randomItem(generateEntry.VALUES) as types.Any,
		[HEAP_NODE_IDX_SYM]: types.SOFT_DELETE
	};
}
generateEntry.VALUES = [undefined, null, false as boolean, 0 as number, '' as string, {}, []] as const;

function gcFactory<K, V>(): GarbageCollector<ExpirableSlidingCacheEntry<K, V>> {
	return Math.random() >= 0.5
		? new HeapGarbageCollector<ExpirableSlidingCacheHeapEntry<K, V>>()
		: new BucketGarbageCollector<ExpirableSlidingCacheEntry<K, V>>();
}

function getWithDefault<K, V>(map: Map<K, V>, key: K, getDefault: () => V): V {
	let value = map.get(key);
	if (!value) {
		value = getDefault();
		map.set(key, value);
	}
	return value;
}

// @fixme create tests with interval gc

describe(`${colors.magenta(SlidingProactiveExpirationPolicy.name)} spec`, () => {
	describe(`${SlidingProactiveExpirationPolicy.prototype.onHit.name.magenta} spec`, () => {
		it('validates entries that have no time span expiration', async () => {
			const ENTRIES = new Map<string, ExpirableSlidingCacheEntry<string, unknown>>([
				['1', generateEntry('1')],
				['2', generateEntry('2')],
				['3', generateEntry('3')],
				['4', generateEntry('4')]
			]);
			function entry(key: string) {
				const entry = ENTRIES.get(key);
				if (!entry) {
					throw new Error(`No entry for key '${key}'`);
				}
				return entry;
			}

			const policy = new SlidingProactiveExpirationPolicy<string, unknown>(gcFactory());
			const EVICTED_KEYS = new Set<string>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.add(evictedEntry.key);
			});

			policy.onSet(entry('1'));
			policy.onSet(entry('2'), { timeSpan: undefined });
			policy.onSet(entry('3'), { timeSpan: null as types.Any });
			policy.onSet(entry('4'), { timeSpan: INFINITE_EXPIRATION });

			policy.onUpdate(entry('1'));
			policy.onUpdate(entry('2'), { timeSpan: undefined });
			policy.onUpdate(entry('3'), { timeSpan: null as types.Any });
			policy.onUpdate(entry('4'), { timeSpan: INFINITE_EXPIRATION });

			expect(policy.size).to.be.eq(0);

			for (const entry of ENTRIES.values()) {
				expect(entry[TIME_SPAN_SYM]).toBeUndefined();
				expect(entry[EXPIRES_AT_SYM]).toBeUndefined();
				expect(policy.onHit(entry)).to.be.eq(EntryValidity.VALID);
			}
			expect(policy.idle).to.be.eq(true);

			const deferred = buildPromiseHolder<void>();
			setTimeout(() => {
				try {
					expect(EVICTED_KEYS.size).to.be.eq(0);
					expect(policy.idle).to.be.eq(true);

					deferred.resolve();
				} catch (error) {
					deferred.reject(error);
				}
			}, 50);
			await deferred.promise;
		});

		it('refreshes expiration with the time span on each entry hit', { timeout: 3500 }, async () => {
			const policy = new SlidingProactiveExpirationPolicy<string, unknown>(gcFactory());
			const EVICTED_KEYS = new Set<string>();
			policy.setDeleter((evictedEntry) => {
				const slidingEntry = evictedEntry as ExpirableSlidingCacheEntry<string, unknown>;

				EVICTED_KEYS.add(evictedEntry.key);
				policy.onDelete(slidingEntry);

				expect(slidingEntry[EXPIRES_AT_SYM]).toBeUndefined();
				expect(slidingEntry[TIME_SPAN_SYM]).toBeUndefined();
			});

			const ENTRY = generateEntry('key');
			policy.onSet(ENTRY, { timeSpan: 2 });

			const deferred = buildPromiseHolder<void>();
			setTimeout(() => {
				try {
					expect(EVICTED_KEYS.size).to.be.eq(0);
					expect(policy.idle).to.be.eq(false);
					expect(policy.onHit(ENTRY)).to.be.eq(EntryValidity.VALID); // refresh expiration
				} catch (error) {
					clearTimeout(entrySlicedTimeout);
					clearTimeout(entryEvictedTimeout);
					deferred.reject(error);
				}
			}, 1000);

			const entrySlicedTimeout = setTimeout(() => {
				try {
					// it was refreshed and will expire later
					expect(EVICTED_KEYS.size).to.be.eq(0);
					expect(policy.idle).to.be.eq(false);
				} catch (error) {
					clearTimeout(entryEvictedTimeout);
					deferred.reject(error);
				}
			}, 2100);

			const entryEvictedTimeout = setTimeout(() => {
				try {
					expect(EVICTED_KEYS.size).to.be.eq(1);
					expect(EVICTED_KEYS.has('key')).to.be.eq(true);
					expect(policy.idle).to.be.eq(true);

					deferred.resolve();
				} catch (error) {
					deferred.reject(error);
				}
			}, 3200);

			await deferred.promise;
		});
	});

	describe(`${SlidingProactiveExpirationPolicy.prototype.onUpdate.name.magenta} spec`, () => {
		it('sets entry expiration, then removes it, then sets it back (gc should restart)', { timeout: 2500 }, async () => {
			const KEY = 'key';
			const ENTRY = generateEntry(KEY);
			const EVICTED_KEYS = new Set<string>();

			const policy = new SlidingProactiveExpirationPolicy<string, unknown>(gcFactory());
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.add(evictedEntry.key);

				const slidingEntry = evictedEntry as ExpirableSlidingCacheEntry<string, unknown>;
				policy.onDelete(slidingEntry);
				expect(slidingEntry[EXPIRES_AT_SYM]).toBeUndefined();
				expect(slidingEntry[TIME_SPAN_SYM]).toBeUndefined();
			});

			policy.onUpdate(ENTRY, { timeSpan: 1 });
			expect(policy.idle).to.be.eq(false);
			expect(ENTRY[EXPIRES_AT_SYM]).toBeDefined();
			expect(ENTRY[TIME_SPAN_SYM]).toBeDefined();

			policy.onUpdate(ENTRY, { timeSpan: INFINITE_EXPIRATION });
			expect(policy.idle).to.be.eq(true);
			expect(ENTRY[EXPIRES_AT_SYM]).toBeUndefined();
			expect(ENTRY[TIME_SPAN_SYM]).toBeUndefined();

			const deferred = buildPromiseHolder<void>();
			setTimeout(() => {
				try {
					expect(EVICTED_KEYS.size).to.be.eq(0); // didn't evict nothing

					policy.onUpdate(ENTRY, { timeSpan: 1 });
					policy.onHit(ENTRY); // should have no effect, will set same expiration as prev one
					expect(policy.idle).to.be.eq(false);
				} catch (error) {
					clearTimeout(entryEvictedTimeout);
					deferred.reject(error);
				}
			}, 1100);

			const entryEvictedTimeout = setTimeout(() => {
				try {
					expect(EVICTED_KEYS.size).to.be.eq(1);
					expect(EVICTED_KEYS.has(KEY)).to.be.eq(true);
					expect(policy.idle).to.be.eq(true);

					deferred.resolve();
				} catch (error) {
					deferred.reject(error);
				}
			}, 2200);

			await deferred.promise;
		});

		it('does nothing if new time span is equal to the previous one', { timeout: 2500 }, async () => {
			const KEY = 'key';
			const ENTRY = generateEntry(KEY);
			const EVICTED_KEYS = new Set<string>();

			const policy = new SlidingProactiveExpirationPolicy<string, unknown>(gcFactory());
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.add(evictedEntry.key);

				const slidingEntry = evictedEntry as ExpirableSlidingCacheEntry<string, unknown>;
				policy.onDelete(slidingEntry);
				expect(slidingEntry[EXPIRES_AT_SYM]).toBeUndefined();
				expect(slidingEntry[TIME_SPAN_SYM]).toBeUndefined();
			});

			policy.onUpdate(ENTRY, { timeSpan: 2 });

			const deferred = buildPromiseHolder<void>();
			setTimeout(() => {
				try {
					expect(policy.idle).to.be.eq(false);
					expect(EVICTED_KEYS.size).to.be.eq(0);

					policy.onUpdate(ENTRY, { timeSpan: 2 });

					expect(policy.idle).to.be.eq(false);
					expect(EVICTED_KEYS.size).to.be.eq(0);
				} catch (error) {
					clearTimeout(entryEvictedTimeout);
					deferred.reject(error);
				}
			}, 1000);

			const entryEvictedTimeout = setTimeout(() => {
				try {
					expect(EVICTED_KEYS.size).to.be.eq(1);
					expect(EVICTED_KEYS.has(KEY)).to.be.eq(true);
					expect(policy.idle).to.be.eq(true);

					deferred.resolve();
				} catch (error) {
					deferred.reject(error);
				}
			}, 2100);

			await deferred.promise;
		});

		it('updates time span and resets entry expiration', { timeout: 2500 }, async () => {
			expect.hasAssertions();

			const KEY = 'key';
			const ENTRY = generateEntry(KEY);
			const EVICTED_KEYS = new Set<string>();

			const policy = new SlidingProactiveExpirationPolicy<string, unknown>(gcFactory());
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.add(evictedEntry.key);
			});

			policy.onUpdate(ENTRY, { timeSpan: 1 });
			policy.onUpdate(ENTRY, { timeSpan: 2 });

			const deferred = buildPromiseHolder<void>();
			setTimeout(() => {
				try {
					// wasn't evicted after 1 sec
					expect(policy.idle).to.be.eq(false);
					expect(EVICTED_KEYS.size).to.be.eq(0);
				} catch (error) {
					clearTimeout(entryEvictedTimeout);
					deferred.reject(error);
				}
			}, 1100);

			const entryEvictedTimeout = setTimeout(() => {
				try {
					expect(EVICTED_KEYS.size).to.be.eq(1);
					expect(EVICTED_KEYS.has(KEY)).to.be.eq(true);
					expect(policy.idle).to.be.eq(true);

					deferred.resolve();
				} catch (error) {
					deferred.reject(error);
				}
			}, 2100);

			await deferred.promise;
		});

		it('simulation of real usage', { timeout: 15_000 }, async () => {
			const INITIAL_TIME_SPAN_SEC = 2;
			const UPDATE_TIME_SPAN_SEC = 3;
			const UPDATE_DELAY_SEC = 1;
			const EPSILON_MS = 1000;
			const TIME_POINTS_COUNT = 4;

			const KEYS = Object.freeze(Array.from({ length: 100 }, (_, i) => String(i)));
			const REFRESH_ON_GET_KEYS = Object.freeze(Array.from({ length: randomInt(1, 70) }, array.randomUniqueItem(KEYS)));
			const KEYS_PER_INSERT_TIME_POINT: ReadonlyMap<number, string[]> = freeze(
				new Map(chunk(KEYS, Math.round(KEYS.length / TIME_POINTS_COUNT)).map((chunked, index) => [index, chunked]))
			);
			const KEY_TO_ENTRY: ReadonlyMap<string, ExpirableSlidingCacheEntry<string, unknown>> = new Map(KEYS.map((key) => [key, generateEntry(key)]));
			const EVICTED_KEYS: string[] = [];

			const policy = new SlidingProactiveExpirationPolicy<string, unknown>(gcFactory<string, unknown>());
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);

				const slidingEntry = evictedEntry as ExpirableSlidingCacheEntry<string, unknown>;
				policy.onDelete(slidingEntry);
				expect(slidingEntry[EXPIRES_AT_SYM]).toBeUndefined();
				expect(slidingEntry[TIME_SPAN_SYM]).toBeUndefined();
			});

			for (const [insertTimePoint, insertionKeys] of KEYS_PER_INSERT_TIME_POINT) {
				setTimeout(() => {
					for (const key of insertionKeys) {
						const entry = KEY_TO_ENTRY.get(key) as ExpirableSlidingCacheEntry<string, unknown>;
						policy.onSet(entry, { timeSpan: INITIAL_TIME_SPAN_SEC });
					}
				}, convert(insertTimePoint, 's').to('ms'));
			}

			const KEYS_EXPIRED_AT = new Map<number, string[]>();

			for (const [insertTimePoint, insertionKeys] of KEYS_PER_INSERT_TIME_POINT) {
				const doUpdateAt = insertTimePoint + UPDATE_DELAY_SEC;
				setTimeout(() => {
					for (const key of insertionKeys) {
						const entry = KEY_TO_ENTRY.get(key) as ExpirableSlidingCacheEntry<string, unknown>;

						let willExpireAt = 0;
						if (REFRESH_ON_GET_KEYS.includes(key)) {
							policy.onHit(entry);
							willExpireAt = doUpdateAt + INITIAL_TIME_SPAN_SEC;
						} else {
							policy.onUpdate(entry, { timeSpan: UPDATE_TIME_SPAN_SEC });
							willExpireAt = doUpdateAt + UPDATE_TIME_SPAN_SEC;
						}

						getWithDefault(KEYS_EXPIRED_AT, willExpireAt, () => []).push(key);
					}
				}, convert(doUpdateAt, 's').to('ms'));
			}

			const deferred = buildPromiseHolder<void>();

			let checkTimePoint = INITIAL_TIME_SPAN_SEC + UPDATE_DELAY_SEC;
			const endCheckTimePoint = KEYS_PER_INSERT_TIME_POINT.size + UPDATE_DELAY_SEC + UPDATE_TIME_SPAN_SEC;
			function checkEvictedKeys(): void {
				try {
					const expiredKeys = getWithDefault(KEYS_EXPIRED_AT, checkTimePoint, () => []);

					for (const key of expiredKeys) {
						expect(EVICTED_KEYS).toContain(key);
					}

					if (++checkTimePoint === endCheckTimePoint) {
						expect(policy.idle).to.be.eq(true);
						deferred.resolve();
						return;
					}

					setTimeout(checkEvictedKeys, convert(1, 's').to('ms') + EPSILON_MS);
				} catch (error) {
					deferred.reject(error);
				}
			}
			setTimeout(checkEvictedKeys, convert(checkTimePoint, 's').to('ms') + EPSILON_MS);

			await deferred.promise;
			expect(EVICTED_KEYS).toHaveLength(KEYS.length);
		});
	});

	describe(`${SlidingProactiveExpirationPolicy.prototype.onDelete.name.magenta} spec`, () => {
		it('does not delete entry which does not have expiration', () => {
			const policy = new SlidingProactiveExpirationPolicy<string, unknown>(gcFactory());
			const EVICTED_KEYS = new Set<string>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.add(evictedEntry.key);
			});

			policy.onDelete(generateEntry('key'));
			expect(EVICTED_KEYS.size).to.be.eq(0);
		});
	});

	describe(`${SlidingProactiveExpirationPolicy.prototype.onClear.name.magenta} spec`, () => {
		it('clears gc even if there are no entries', () => {
			const policy = new SlidingProactiveExpirationPolicy<string, unknown>(gcFactory());
			expect(policy.idle).to.be.eq(true);
			policy.onClear();
			expect(policy.idle).to.be.eq(true);
		});

		it('clears internal structures and stops gc', () => {
			const policy = new SlidingProactiveExpirationPolicy<string, unknown>(gcFactory());

			policy.onSet(generateEntry('key1'), { timeSpan: 1 });
			policy.onSet(generateEntry('key2'), { timeSpan: 2 });
			policy.onSet(generateEntry('key3.1'), { timeSpan: 3 });
			policy.onSet(generateEntry('key3.2'), { timeSpan: 3 });
			policy.onSet(generateEntry('key4'), { timeSpan: 4 });

			expect(policy.size).to.be.eq(5);
			expect(policy.idle).to.be.eq(false);

			policy.onClear();
			expect(policy.idle).to.be.eq(true);
		});

		it('restarts gc after clear', async () => {
			const policy = new SlidingProactiveExpirationPolicy<string, unknown>(gcFactory());
			const EVICTED_KEYS = new Set<string>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.add(evictedEntry.key);
			});

			policy.onSet(generateEntry('key1'), { timeSpan: 1 });
			expect(policy.idle).to.be.eq(false);

			policy.onClear();
			expect(policy.idle).to.be.eq(true);

			policy.onSet(generateEntry('key2'), { timeSpan: 1 });
			expect(policy.idle).to.be.eq(false);
			expect(EVICTED_KEYS.size).to.be.eq(0);

			const deferred = buildPromiseHolder<void>();
			setTimeout(() => {
				try {
					expect(policy.idle).to.be.eq(true);
					expect(EVICTED_KEYS.size).to.be.eq(1);
					expect(EVICTED_KEYS.has('key2')).to.be.eq(true);

					deferred.resolve();
				} catch (error) {
					deferred.reject(error);
				}
			}, 1100);
			await deferred.promise;
		});
	});
});

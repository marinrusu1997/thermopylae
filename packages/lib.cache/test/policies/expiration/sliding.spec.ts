import { describe, it } from 'mocha';
import colors from 'colors';
import { array, number, string } from '@thermopylae/lib.utils';
import { expect } from '@thermopylae/lib.unit-test';
import { ExpirableSlidingCacheEntry, SlidingProactiveExpirationPolicy, TIME_SPAN_SYM } from '../../../lib/policies/expiration/sliding';
import { EXPIRES_AT_SYM, INFINITE_EXPIRATION } from '../../../lib/constants';
import { EntryValidity } from '../../../lib/contracts/replacement-policy';
import { GarbageCollector } from '../../../lib/data-structures/garbage-collector/interface';
import { HeapGarbageCollector } from '../../../lib/data-structures/garbage-collector/heap-gc';
import { BucketGarbageCollector } from '../../../lib/data-structures/garbage-collector/bucket-gc';

function generateEntry(): ExpirableSlidingCacheEntry<string, any> {
	return {
		key: '',
		value: array.randomElement(generateEntry.VALUES)
	};
}
generateEntry.VALUES = [undefined, null, false, 0, '', {}, []];

function gcFactory(): GarbageCollector<any> {
	const gc = Math.random() >= 0.5 ? new HeapGarbageCollector() : new BucketGarbageCollector();
	// UnitTestLogger.info(`Using ${gc.constructor.name.magenta}`);
	return gc;
}

// @fixme create tests with interval gc

describe(`${colors.magenta(SlidingProactiveExpirationPolicy.name)} spec`, () => {
	describe(`${SlidingProactiveExpirationPolicy.prototype.onGet.name.magenta} spec`, () => {
		it('validates entries that have no time span expiration', (done) => {
			const ENTRIES = new Map<string, ExpirableSlidingCacheEntry<string, any>>([
				['1', generateEntry()],
				['2', generateEntry()],
				['3', generateEntry()],
				['4', generateEntry()]
			]);

			const policy = new SlidingProactiveExpirationPolicy<string, any>(gcFactory());
			const EVICTED_KEYS = new Set<string>();
			policy.setDeleter((key) => {
				EVICTED_KEYS.add(key);
			});

			policy.onSet('1', ENTRIES.get('1')!);
			policy.onSet('2', ENTRIES.get('2')!, { timeSpan: undefined });
			policy.onSet('3', ENTRIES.get('3')!, { timeSpan: null! });
			policy.onSet('4', ENTRIES.get('4')!, { timeSpan: INFINITE_EXPIRATION });

			policy.onUpdate('1', ENTRIES.get('1')!);
			policy.onUpdate('2', ENTRIES.get('2')!, { timeSpan: undefined });
			policy.onUpdate('3', ENTRIES.get('3')!, { timeSpan: null! });
			policy.onUpdate('4', ENTRIES.get('4')!, { timeSpan: INFINITE_EXPIRATION });

			expect(policy.size).to.be.eq(0);

			for (const [key, entry] of ENTRIES.entries()) {
				expect(entry[TIME_SPAN_SYM]).to.be.eq(undefined);
				expect(entry[EXPIRES_AT_SYM]).to.be.eq(undefined);
				expect(policy.onGet(key, entry)).to.be.eq(EntryValidity.VALID);
			}
			expect(policy.idle).to.be.eq(true);

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS.size).to.be.eq(0);
					expect(policy.idle).to.be.eq(true);

					done();
				} catch (e) {
					done(e);
				}
			}, 50);
		});

		it('refreshes expiration with the time span on each entry hit', (done) => {
			const policy = new SlidingProactiveExpirationPolicy<string, any>(gcFactory());
			const EVICTED_KEYS = new Set<string>();
			policy.setDeleter((evictedKey, evictedEntry) => {
				const slidingEntry = evictedEntry as ExpirableSlidingCacheEntry<string, any>;

				EVICTED_KEYS.add(evictedKey);
				policy.onDelete(evictedKey, slidingEntry);

				expect(slidingEntry[EXPIRES_AT_SYM]).to.be.eq(undefined);
				expect(slidingEntry[TIME_SPAN_SYM]).to.be.eq(undefined);
			});

			const ENTRY = generateEntry();
			policy.onSet('key', ENTRY, { timeSpan: 2 });

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS.size).to.be.eq(0);
					expect(policy.idle).to.be.eq(false);
					expect(policy.onGet('key', ENTRY)).to.be.eq(EntryValidity.VALID); // refresh expiration
				} catch (e) {
					clearTimeout(entrySlicedTimeout);
					clearTimeout(entryEvictedTimeout);
					done(e);
				}
			}, 1000);

			const entrySlicedTimeout = setTimeout(() => {
				try {
					// it was refreshed and will expire later
					expect(EVICTED_KEYS.size).to.be.eq(0);
					expect(policy.idle).to.be.eq(false);
				} catch (e) {
					clearTimeout(entryEvictedTimeout);
					done(e);
				}
			}, 2100);

			const entryEvictedTimeout = setTimeout(() => {
				try {
					expect(EVICTED_KEYS.size).to.be.eq(1);
					expect(EVICTED_KEYS.has('key')).to.be.eq(true);
					expect(policy.idle).to.be.eq(true);

					done();
				} catch (e) {
					done(e);
				}
			}, 3200);
		}).timeout(3500);
	});

	describe(`${SlidingProactiveExpirationPolicy.prototype.onUpdate.name.magenta} spec`, () => {
		it('sets entry expiration, then removes it, then sets it back (gc should restart)', (done) => {
			const KEY = 'key';
			const ENTRY = generateEntry();
			const EVICTED_KEYS = new Set<string>();

			const policy = new SlidingProactiveExpirationPolicy<string, any>(gcFactory());
			policy.setDeleter((evictedKey, evictedEntry) => {
				EVICTED_KEYS.add(evictedKey);

				const slidingEntry = evictedEntry as ExpirableSlidingCacheEntry<string, any>;
				policy.onDelete(evictedKey, slidingEntry);
				expect(slidingEntry[EXPIRES_AT_SYM]).to.be.eq(undefined);
				expect(slidingEntry[TIME_SPAN_SYM]).to.be.eq(undefined);
			});

			policy.onUpdate(KEY, ENTRY, { timeSpan: 1 });
			expect(policy.idle).to.be.eq(false);
			expect(ENTRY[EXPIRES_AT_SYM]).to.not.be.eq(undefined);
			expect(ENTRY[TIME_SPAN_SYM]).to.not.be.eq(undefined);

			policy.onUpdate(KEY, ENTRY, { timeSpan: INFINITE_EXPIRATION });
			expect(policy.idle).to.be.eq(true);
			expect(ENTRY[EXPIRES_AT_SYM]).to.be.eq(undefined);
			expect(ENTRY[TIME_SPAN_SYM]).to.be.eq(undefined);

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS.size).to.be.eq(0); // didn't evict nothing

					policy.onUpdate(KEY, ENTRY, { timeSpan: 1 });
					policy.onGet(KEY, ENTRY); // should have no effect, will set same expiration as prev one
					expect(policy.idle).to.be.eq(false);
				} catch (e) {
					clearTimeout(entryEvictedTimeout);
					done(e);
				}
			}, 1100);

			const entryEvictedTimeout = setTimeout(() => {
				try {
					expect(EVICTED_KEYS.size).to.be.eq(1);
					expect(EVICTED_KEYS.has(KEY)).to.be.eq(true);
					expect(policy.idle).to.be.eq(true);

					done();
				} catch (e) {
					done(e);
				}
			}, 2200);
		}).timeout(2500);

		it('does nothing if new time span is equal to the previous one', (done) => {
			const KEY = 'key';
			const ENTRY = generateEntry();
			const EVICTED_KEYS = new Set<string>();

			const policy = new SlidingProactiveExpirationPolicy<string, any>(gcFactory());
			policy.setDeleter((evictedKey, evictedEntry) => {
				EVICTED_KEYS.add(evictedKey);

				const slidingEntry = evictedEntry as ExpirableSlidingCacheEntry<string, any>;
				policy.onDelete(evictedKey, slidingEntry);
				expect(slidingEntry[EXPIRES_AT_SYM]).to.be.eq(undefined);
				expect(slidingEntry[TIME_SPAN_SYM]).to.be.eq(undefined);
			});

			policy.onUpdate(KEY, ENTRY, { timeSpan: 2 });

			setTimeout(() => {
				try {
					expect(policy.idle).to.be.eq(false);
					expect(EVICTED_KEYS.size).to.be.eq(0);

					policy.onUpdate(KEY, ENTRY, { timeSpan: 2 });

					expect(policy.idle).to.be.eq(false);
					expect(EVICTED_KEYS.size).to.be.eq(0);
				} catch (e) {
					clearTimeout(entryEvictedTimeout);
					done(e);
				}
			}, 1000);

			const entryEvictedTimeout = setTimeout(() => {
				try {
					expect(EVICTED_KEYS.size).to.be.eq(1);
					expect(EVICTED_KEYS.has(KEY)).to.be.eq(true);
					expect(policy.idle).to.be.eq(true);

					done();
				} catch (e) {
					done(e);
				}
			}, 2100);
		}).timeout(2500);

		it('updates time span and resets entry expiration', (done) => {
			const KEY = 'key';
			const ENTRY = generateEntry();
			const EVICTED_KEYS = new Set<string>();

			const policy = new SlidingProactiveExpirationPolicy<string, any>(gcFactory());
			policy.setDeleter((evictedKey) => {
				EVICTED_KEYS.add(evictedKey);
			});

			policy.onUpdate(KEY, ENTRY, { timeSpan: 1 });
			policy.onUpdate(KEY, ENTRY, { timeSpan: 2 });

			setTimeout(() => {
				try {
					// wasn't evicted after 1 sec
					expect(policy.idle).to.be.eq(false);
					expect(EVICTED_KEYS.size).to.be.eq(0);
				} catch (e) {
					clearTimeout(entryEvictedTimeout);
					done(e);
				}
			}, 1100);

			const entryEvictedTimeout = setTimeout(() => {
				try {
					expect(EVICTED_KEYS.size).to.be.eq(1);
					expect(EVICTED_KEYS.has(KEY)).to.be.eq(true);
					expect(policy.idle).to.be.eq(true);

					done();
				} catch (e) {
					done(e);
				}
			}, 2100);
		}).timeout(2500);

		it('simulation of real usage', (done) => {
			const KEYS = array.filledWith(100, () => string.random(), { noDuplicates: true });
			const REFRESH_ON_GET_KEYS = new Set(array.filledWith(number.randomInt(1, 70), () => array.randomElement(KEYS), { noDuplicates: true }));
			const KEY_TO_ENTRY = new Map<string, ExpirableSlidingCacheEntry<string, any>>();

			const KEYS_PER_INSERT_TIME_POINT = new Map<number, Array<string>>();
			const MAX_TIME_POINTS = 4;

			let keysIndex = 0;
			for (let i = 0; i < MAX_TIME_POINTS; i++) {
				let noOfKeys = number.randomInt(0, KEYS.length);
				const keysPerTimePoint = [];
				for (; keysIndex < KEYS.length && noOfKeys; noOfKeys--) {
					keysPerTimePoint.push(KEYS[keysIndex++]);
				}
				KEYS_PER_INSERT_TIME_POINT.set(i, keysPerTimePoint);
			}

			const policy = new SlidingProactiveExpirationPolicy<string, any>(gcFactory());
			const EVICTED_KEYS = new Set<string>();
			policy.setDeleter((evictedKey, evictedEntry) => {
				EVICTED_KEYS.add(evictedKey);

				const slidingEntry = evictedEntry as ExpirableSlidingCacheEntry<string, any>;
				policy.onDelete(evictedKey, slidingEntry);
				expect(slidingEntry[EXPIRES_AT_SYM]).to.be.eq(undefined);
				expect(slidingEntry[TIME_SPAN_SYM]).to.be.eq(undefined);
			});

			for (let insertionAttempts = 0; insertionAttempts < MAX_TIME_POINTS; insertionAttempts++) {
				setTimeout(() => {
					for (const key of KEYS_PER_INSERT_TIME_POINT.get(insertionAttempts)!) {
						const entry = generateEntry();
						policy.onUpdate(key, entry, { timeSpan: 2 });
						KEY_TO_ENTRY.set(key, entry);
					}
				}, insertionAttempts * 1000);
			}

			const KEYS_EXPIRED_AT = new Map<number, Array<string>>([
				[3, []],
				[4, []],
				[5, []],
				[6, []],
				[7, []],
				[8, []]
			]);

			for (let extensionAttempts = 0; extensionAttempts < MAX_TIME_POINTS; extensionAttempts++) {
				setTimeout(() => {
					for (const key of KEYS_PER_INSERT_TIME_POINT.get(extensionAttempts)!) {
						if (REFRESH_ON_GET_KEYS.has(key)) {
							policy.onGet(key, KEY_TO_ENTRY.get(key)!);
							KEYS_EXPIRED_AT.get(extensionAttempts + 3)!.push(key);
						} else {
							policy.onUpdate(key, KEY_TO_ENTRY.get(key)!, { timeSpan: 3 });
							KEYS_EXPIRED_AT.get(extensionAttempts + 4)!.push(key);
						}
					}
				}, extensionAttempts * 1000 + 1000);
			}

			let checkTimePoint = 3;
			function checkEvictedKeys(): void {
				try {
					for (const key of KEYS_EXPIRED_AT.get(checkTimePoint)!) {
						expect(EVICTED_KEYS.has(key)).to.be.eq(true);
					}

					if (++checkTimePoint === 8) {
						expect(policy.idle).to.be.eq(true);
						done();
						return;
					}

					setTimeout(checkEvictedKeys, 1100);
				} catch (e) {
					done(e);
				}
			}
			setTimeout(checkEvictedKeys, checkTimePoint * 1000 + 100);
		}).timeout(8500);
	});

	describe(`${SlidingProactiveExpirationPolicy.prototype.onDelete.name.magenta} spec`, () => {
		it('does not delete entry which does not have expiration', () => {
			const policy = new SlidingProactiveExpirationPolicy<string, any>(gcFactory());
			const EVICTED_KEYS = new Set<string>();
			policy.setDeleter((evictedKey) => {
				EVICTED_KEYS.add(evictedKey);
			});

			policy.onDelete('key', generateEntry());
			expect(EVICTED_KEYS.size).to.be.eq(0);
		});
	});

	describe(`${SlidingProactiveExpirationPolicy.prototype.onClear.name.magenta} spec`, () => {
		it('clears gc even if there are no entries', () => {
			const policy = new SlidingProactiveExpirationPolicy<string, any>(gcFactory());
			expect(policy.idle).to.be.eq(true);
			policy.onClear();
			expect(policy.idle).to.be.eq(true);
		});

		it('clears internal structures and stops gc', () => {
			const policy = new SlidingProactiveExpirationPolicy<string, any>(gcFactory());

			policy.onSet('key1', generateEntry(), { timeSpan: 1 });
			policy.onSet('key2', generateEntry(), { timeSpan: 2 });
			policy.onSet('key3.1', generateEntry(), { timeSpan: 3 });
			policy.onSet('key3.2', generateEntry(), { timeSpan: 3 });
			policy.onSet('key4', generateEntry(), { timeSpan: 4 });

			expect(policy.size).to.be.eq(5);
			expect(policy.idle).to.be.eq(false);

			policy.onClear();
			expect(policy.idle).to.be.eq(true);
		});

		it('restarts gc after clear', (done) => {
			const policy = new SlidingProactiveExpirationPolicy<string, any>(gcFactory());
			const EVICTED_KEYS = new Set<string>();
			policy.setDeleter((evictedKey) => {
				EVICTED_KEYS.add(evictedKey);
			});

			policy.onSet('key1', generateEntry(), { timeSpan: 1 });
			expect(policy.idle).to.be.eq(false);

			policy.onClear();
			expect(policy.idle).to.be.eq(true);

			policy.onSet('key2', generateEntry(), { timeSpan: 1 });
			expect(policy.idle).to.be.eq(false);
			expect(EVICTED_KEYS.size).to.be.eq(0);

			setTimeout(() => {
				try {
					expect(policy.idle).to.be.eq(true);
					expect(EVICTED_KEYS.size).to.be.eq(1);
					expect(EVICTED_KEYS.has('key2')).to.be.eq(true);

					done();
				} catch (e) {
					done(e);
				}
			}, 1100);
		});
	});
});

import { describe, it } from 'mocha';
import colors from 'colors';
import { array, number, string } from '@thermopylae/lib.utils';
import { expect } from '@thermopylae/lib.unit-test';
import { ExpirableSlidingCacheEntry, SlidingProactiveExpirationPolicy, TIME_SPAN_SYM } from '../../../lib/policies/expiration/sliding';
import { EXPIRES_AT_SYM, INFINITE_EXPIRATION } from '../../../lib/constants';
import { EntryValidity, GarbageCollector, HeapGarbageCollector, BucketGarbageCollector } from '../../../lib';

function generateEntry(key: string): ExpirableSlidingCacheEntry<string, any> {
	return {
		key,
		value: array.randomElement(generateEntry.VALUES)
	};
}
generateEntry.VALUES = [undefined, null, false, 0, '', {}, []];

function gcFactory(): GarbageCollector<any> {
	const gc = Math.random() >= 0.5 ? new HeapGarbageCollector() : new BucketGarbageCollector();
	// logger.info(`Using ${gc.constructor.name.magenta}`);
	return gc;
}

// @fixme create tests with interval gc

describe(`${colors.magenta(SlidingProactiveExpirationPolicy.name)} spec`, () => {
	describe(`${SlidingProactiveExpirationPolicy.prototype.onHit.name.magenta} spec`, () => {
		it('validates entries that have no time span expiration', (done) => {
			const ENTRIES = new Map<string, ExpirableSlidingCacheEntry<string, any>>([
				['1', generateEntry('1')],
				['2', generateEntry('2')],
				['3', generateEntry('3')],
				['4', generateEntry('4')]
			]);

			const policy = new SlidingProactiveExpirationPolicy<string, any>(gcFactory());
			const EVICTED_KEYS = new Set<string>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.add(evictedEntry.key);
			});

			policy.onSet(ENTRIES.get('1')!);
			policy.onSet(ENTRIES.get('2')!, { timeSpan: undefined });
			policy.onSet(ENTRIES.get('3')!, { timeSpan: null! });
			policy.onSet(ENTRIES.get('4')!, { timeSpan: INFINITE_EXPIRATION });

			policy.onUpdate(ENTRIES.get('1')!);
			policy.onUpdate(ENTRIES.get('2')!, { timeSpan: undefined });
			policy.onUpdate(ENTRIES.get('3')!, { timeSpan: null! });
			policy.onUpdate(ENTRIES.get('4')!, { timeSpan: INFINITE_EXPIRATION });

			expect(policy.size).to.be.eq(0);

			for (const entry of ENTRIES.values()) {
				expect(entry[TIME_SPAN_SYM]).to.be.eq(undefined);
				expect(entry[EXPIRES_AT_SYM]).to.be.eq(undefined);
				expect(policy.onHit(entry)).to.be.eq(EntryValidity.VALID);
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
			policy.setDeleter((evictedEntry) => {
				const slidingEntry = evictedEntry as ExpirableSlidingCacheEntry<string, any>;

				EVICTED_KEYS.add(evictedEntry.key);
				policy.onDelete(slidingEntry);

				expect(slidingEntry[EXPIRES_AT_SYM]).to.be.eq(undefined);
				expect(slidingEntry[TIME_SPAN_SYM]).to.be.eq(undefined);
			});

			const ENTRY = generateEntry('key');
			policy.onSet(ENTRY, { timeSpan: 2 });

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS.size).to.be.eq(0);
					expect(policy.idle).to.be.eq(false);
					expect(policy.onHit(ENTRY)).to.be.eq(EntryValidity.VALID); // refresh expiration
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
			const ENTRY = generateEntry(KEY);
			const EVICTED_KEYS = new Set<string>();

			const policy = new SlidingProactiveExpirationPolicy<string, any>(gcFactory());
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.add(evictedEntry.key);

				const slidingEntry = evictedEntry as ExpirableSlidingCacheEntry<string, any>;
				policy.onDelete(slidingEntry);
				expect(slidingEntry[EXPIRES_AT_SYM]).to.be.eq(undefined);
				expect(slidingEntry[TIME_SPAN_SYM]).to.be.eq(undefined);
			});

			policy.onUpdate(ENTRY, { timeSpan: 1 });
			expect(policy.idle).to.be.eq(false);
			expect(ENTRY[EXPIRES_AT_SYM]).to.not.be.eq(undefined);
			expect(ENTRY[TIME_SPAN_SYM]).to.not.be.eq(undefined);

			policy.onUpdate(ENTRY, { timeSpan: INFINITE_EXPIRATION });
			expect(policy.idle).to.be.eq(true);
			expect(ENTRY[EXPIRES_AT_SYM]).to.be.eq(undefined);
			expect(ENTRY[TIME_SPAN_SYM]).to.be.eq(undefined);

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS.size).to.be.eq(0); // didn't evict nothing

					policy.onUpdate(ENTRY, { timeSpan: 1 });
					policy.onHit(ENTRY); // should have no effect, will set same expiration as prev one
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
			const ENTRY = generateEntry(KEY);
			const EVICTED_KEYS = new Set<string>();

			const policy = new SlidingProactiveExpirationPolicy<string, any>(gcFactory());
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.add(evictedEntry.key);

				const slidingEntry = evictedEntry as ExpirableSlidingCacheEntry<string, any>;
				policy.onDelete(slidingEntry);
				expect(slidingEntry[EXPIRES_AT_SYM]).to.be.eq(undefined);
				expect(slidingEntry[TIME_SPAN_SYM]).to.be.eq(undefined);
			});

			policy.onUpdate(ENTRY, { timeSpan: 2 });

			setTimeout(() => {
				try {
					expect(policy.idle).to.be.eq(false);
					expect(EVICTED_KEYS.size).to.be.eq(0);

					policy.onUpdate(ENTRY, { timeSpan: 2 });

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
			const ENTRY = generateEntry(KEY);
			const EVICTED_KEYS = new Set<string>();

			const policy = new SlidingProactiveExpirationPolicy<string, any>(gcFactory());
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.add(evictedEntry.key);
			});

			policy.onUpdate(ENTRY, { timeSpan: 1 });
			policy.onUpdate(ENTRY, { timeSpan: 2 });

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
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.add(evictedEntry.key);

				const slidingEntry = evictedEntry as ExpirableSlidingCacheEntry<string, any>;
				policy.onDelete(slidingEntry);
				expect(slidingEntry[EXPIRES_AT_SYM]).to.be.eq(undefined);
				expect(slidingEntry[TIME_SPAN_SYM]).to.be.eq(undefined);
			});

			for (let insertionAttempts = 0; insertionAttempts < MAX_TIME_POINTS; insertionAttempts++) {
				setTimeout(() => {
					for (const key of KEYS_PER_INSERT_TIME_POINT.get(insertionAttempts)!) {
						const entry = generateEntry(key);
						policy.onUpdate(entry, { timeSpan: 2 });
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
							policy.onHit(KEY_TO_ENTRY.get(key)!);
							KEYS_EXPIRED_AT.get(extensionAttempts + 3)!.push(key);
						} else {
							policy.onUpdate(KEY_TO_ENTRY.get(key)!, { timeSpan: 3 });
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
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.add(evictedEntry.key);
			});

			policy.onDelete(generateEntry('key'));
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

		it('restarts gc after clear', (done) => {
			const policy = new SlidingProactiveExpirationPolicy<string, any>(gcFactory());
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

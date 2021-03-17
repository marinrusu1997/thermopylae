import { describe, it } from 'mocha';
import colors from 'colors';
import range from 'lodash.range';
import { array, chrono, number } from '@thermopylae/lib.utils';
import { expect } from '@thermopylae/lib.unit-test';
import { UnitTestLogger } from '@thermopylae/lib.unit-test/dist/logger';
import { MixedExpirationPolicy, MixedExpirationPolicyConfig } from '../../../lib/policies/expiration/mixed';
import { ExpirableCacheEntry, ExpirableCacheKeyedEntry, EXPIRES_AT_SYM } from '../../../lib/policies/expiration/abstract';
import { createCacheEntriesCircularIterator } from '../../../lib/utils';
import { INFINITE_TTL } from '../../../lib/constants';
import { EntryValidity } from '../../../lib/contracts/replacement-policy';

describe(`${colors.magenta(MixedExpirationPolicy.name)} spec`, () => {
	describe(`${MixedExpirationPolicy.prototype.onHit.name.magenta} spec`, () => {
		it('should evict expired entries on hit', (done) => {
			const CAPACITY = number.randomInt(1, 10);
			const KEYS = range(0, CAPACITY).map(String);
			const TTL = [1, 2];
			const KEYS_BY_TTL = new Map<string, number>(KEYS.map((key) => [key, array.randomElement(TTL)]));
			const ENTRIES = new Map<string, ExpirableCacheKeyedEntry<string, number>>(
				KEYS.map((key) => {
					return [
						key,
						{
							key: '', // overwritten onSet
							value: Number(key)
						}
					];
				})
			);

			const CONFIG: MixedExpirationPolicyConfig<string, number> = {
				checkInterval: 2,
				iterateThreshold: number.randomInt(1, CAPACITY),
				getNextCacheEntry: createCacheEntriesCircularIterator(ENTRIES),
				getCacheSize: () => ENTRIES.size
			};
			const policy = new MixedExpirationPolicy<string, number>(CONFIG);

			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedKey, evictedEntry) => {
				ENTRIES.delete(evictedKey);
				EVICTED_KEYS.push(evictedKey);

				policy.onDelete(evictedKey, evictedEntry);
				expect((evictedEntry as ExpirableCacheEntry<number>)[EXPIRES_AT_SYM]).to.be.eq(undefined);
			});

			function logTestContext() {
				const message = [
					'Test Context:',
					`${'CAPACITY'.magenta}\t\t: ${CAPACITY}`,
					`${'KEYS_BY_TTL'.magenta}\t: ${JSON.stringify(KEYS_BY_TTL)}`,
					`${'CONFIG.iterateThreshold'.magenta}: ${CONFIG.iterateThreshold}`,
					`${'EVICTED_KEYS'.magenta}\t: ${JSON.stringify(EVICTED_KEYS)}`
				];

				UnitTestLogger.info(message.join('\n'));
			}

			for (const [key, entry] of ENTRIES) {
				policy.onSet(key, entry, { expiresAfter: KEYS_BY_TTL.get(key) });
			}

			setTimeout(() => {
				try {
					for (const [key, ttl] of KEYS_BY_TTL) {
						if (ttl === 1) {
							expect(policy.onHit(key, ENTRIES.get(key)!)).to.be.eq(EntryValidity.NOT_VALID);
							expect(EVICTED_KEYS).to.be.containing(key);
						}
					}
				} catch (e) {
					clearTimeout(twoSecTtlTimeout);
					logTestContext();
					done(e);
				}
			}, 1100);

			const twoSecTtlTimeout = setTimeout(() => {
				try {
					const keysWith1SecTtl = [...KEYS_BY_TTL].filter(([, ttl]) => ttl === 1).map(([key]) => key);
					const keysWith2SecTtl = [...KEYS_BY_TTL].filter(([, ttl]) => ttl === 2).map(([key]) => key);

					const evictedKeysNoByTimer = Math.min(keysWith2SecTtl.length, CONFIG.iterateThreshold!);
					expect(EVICTED_KEYS).to.be.ofSize(keysWith1SecTtl.length + evictedKeysNoByTimer);

					if (keysWith2SecTtl.length) {
						expect(EVICTED_KEYS).to.be.containingAnyOf(keysWith2SecTtl);
					}

					expect(policy.isIdle()).to.be.eq(ENTRIES.size === 0);
					done();
				} catch (e) {
					logTestContext();
					done(e);
				}
			}, 2100);
		}).timeout(2200);
	});

	describe(`${MixedExpirationPolicy.prototype.onSet.name.magenta} spec`, () => {
		it('should iterate over entries with the given iteration step and evict all expired entries', (done) => {
			const CAPACITY = number.randomInt(1, 20);
			const KEYS = range(0, CAPACITY).map(String);

			const TTL = [1, 2];
			const KEY_TO_TTL = new Map<string, number>(
				(KEYS.map((key) => [key, array.randomElement(TTL)]) as [string, number][]).sort((first, second) => first[1] - second[1])
			);
			const KEY_TO_TTL_ENTRIES = [...KEY_TO_TTL];
			const KEYS_BY_TTL = {
				ONE_SECOND: KEY_TO_TTL_ENTRIES.filter((entry) => entry[1] === 1).map((entry) => entry[0]),
				TWO_SECOND: KEY_TO_TTL_ENTRIES.filter((entry) => entry[1] === 2).map((entry) => entry[0])
			};

			const ENTRIES = new Map<string, ExpirableCacheKeyedEntry<string, number>>(
				[...KEY_TO_TTL.keys()].map((key) => {
					return [
						key,
						{
							key: '', // overwritten onSet
							value: Number(key)
						}
					];
				})
			);

			const CONFIG: MixedExpirationPolicyConfig<string, number> = {
				checkInterval: 1,
				iterateThreshold: KEYS_BY_TTL.ONE_SECOND.length || KEYS_BY_TTL.TWO_SECOND.length,
				getNextCacheEntry: createCacheEntriesCircularIterator(ENTRIES),
				getCacheSize: () => ENTRIES.size
			};
			const policy = new MixedExpirationPolicy<string, number>(CONFIG);

			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedKey, evictedEntry) => {
				ENTRIES.delete(evictedKey);
				EVICTED_KEYS.push(evictedKey);

				policy.onDelete(evictedKey, evictedEntry);
				expect((evictedEntry as ExpirableCacheEntry<number>)[EXPIRES_AT_SYM]).to.be.eq(undefined);
			});

			function logTestContext() {
				const message = [
					'Test Context:',
					`${'CAPACITY'.magenta}\t\t: ${CAPACITY}`,
					`${'KEY_TO_TTL'.magenta}\t: ${JSON.stringify([...KEY_TO_TTL])}`,
					`${'KEYS_BY_TTL'.magenta}\t: ${JSON.stringify(KEYS_BY_TTL)}`,
					`${'CONFIG.iterateThreshold'.magenta}: ${CONFIG.iterateThreshold}`,
					`${'EVICTED_KEYS'.magenta}\t: ${JSON.stringify(EVICTED_KEYS)}`
				];

				UnitTestLogger.info(message.join('\n'));
			}

			for (const [key, entry] of ENTRIES) {
				policy.onSet(key, entry, { expiresAfter: KEY_TO_TTL.get(key) });
			}

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(KEYS_BY_TTL.ONE_SECOND.length);
					expect(EVICTED_KEYS).to.be.containingAllOf(KEYS_BY_TTL.ONE_SECOND);
				} catch (e) {
					logTestContext();
					clearTimeout(twoSecTtlTimeout);
					done(e);
				}
			}, 1100);

			const twoSecTtlTimeout = setTimeout(() => {
				try {
					const expectedNumOfEvictedKeys = KEYS_BY_TTL.ONE_SECOND.length + Math.min(CONFIG.iterateThreshold!, KEYS_BY_TTL.TWO_SECOND.length);

					expect(EVICTED_KEYS).to.be.ofSize(expectedNumOfEvictedKeys);

					if (KEYS_BY_TTL.TWO_SECOND.length) {
						// we check for entries, because `containingAnyOf` with empty array will fail
						// also if we get here, it means at least 1 of the TWO_SECOND_TTL keys should be evicted
						expect(EVICTED_KEYS).to.be.containingAnyOf(KEYS_BY_TTL.TWO_SECOND);
					}

					expect(policy.isIdle()).to.be.eq(expectedNumOfEvictedKeys === KEYS_BY_TTL.ONE_SECOND.length + KEYS_BY_TTL.TWO_SECOND.length);

					done();
				} catch (e) {
					logTestContext();
					done(e);
				}
			}, 2100);
		}).timeout(2200);
	});

	describe(`${MixedExpirationPolicy.prototype.onUpdate.name.magenta} spec`, () => {
		it('should update entry ttl and evict expired entries', (done) => {
			const CAPACITY = number.randomInt(1, 10);
			const KEYS = range(0, CAPACITY).map(String);
			const TTL = 1;
			const KEYS_WITH_INFINITE_TTL = array.filledWith(number.randomInt(1, CAPACITY), () => array.randomElement(KEYS), { noDuplicates: true });
			const KEY_TO_TTL = new Map<string, number>(KEYS.map((key) => [key, TTL]));
			const ENTRIES = new Map<string, ExpirableCacheKeyedEntry<string, number>>();

			// insert keys with ttl first, so they might be evicted
			for (const key of KEYS) {
				if (!KEYS_WITH_INFINITE_TTL.includes(key)) {
					ENTRIES.set(key, { key: '', value: Number(key) });
				}
			}
			// insert keys without ttl second
			for (const key of KEYS_WITH_INFINITE_TTL) {
				ENTRIES.set(key, { key: '', value: Number(key) });
			}

			const CONFIG: MixedExpirationPolicyConfig<string, number> = {
				checkInterval: 1,
				iterateThreshold: number.randomInt(1, CAPACITY),
				getNextCacheEntry: createCacheEntriesCircularIterator(ENTRIES),
				getCacheSize: () => ENTRIES.size
			};
			const policy = new MixedExpirationPolicy<string, number>(CONFIG);

			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedKey, evictedEntry) => {
				ENTRIES.delete(evictedKey);
				EVICTED_KEYS.push(evictedKey);

				policy.onDelete(evictedKey, evictedEntry);
				expect((evictedEntry as ExpirableCacheEntry<number>)[EXPIRES_AT_SYM]).to.be.eq(undefined);
			});

			function logTestContext() {
				const message = [
					'Test Context:',
					`${'CAPACITY'.magenta}\t\t: ${CAPACITY}`,
					`${'KEY_TO_TTL'.magenta}\t: ${JSON.stringify([...KEY_TO_TTL])}`,
					`${'KEYS_WITH_INFINITE_TTL'.magenta}\t: ${JSON.stringify(KEYS_WITH_INFINITE_TTL)}`,
					`${'CONFIG.iterateThreshold'.magenta}: ${CONFIG.iterateThreshold}`,
					`${'EVICTED_KEYS'.magenta}\t: ${JSON.stringify(EVICTED_KEYS)}`
				];

				UnitTestLogger.info(message.join('\n'));
			}

			for (const [key, entry] of ENTRIES) {
				policy.onSet(key, entry, { expiresAfter: KEY_TO_TTL.get(key) });
			}
			for (const key of KEYS_WITH_INFINITE_TTL) {
				policy.onUpdate(key, ENTRIES.get(key)!, { expiresAfter: INFINITE_TTL });
			}

			setTimeout(() => {
				try {
					const expectedEvictedKeys = KEYS.filter((key) => !KEYS_WITH_INFINITE_TTL.includes(key));
					const numberOfEvictedKeys = Math.min(expectedEvictedKeys.length, CONFIG.iterateThreshold!);

					expect(EVICTED_KEYS).to.be.ofSize(numberOfEvictedKeys);

					if (expectedEvictedKeys.length) {
						expect(EVICTED_KEYS).to.be.containingAnyOf(expectedEvictedKeys); // at least some of them must be evicted
					}

					expect(policy.isIdle()).to.be.eq(ENTRIES.size === 0);

					done();
				} catch (e) {
					logTestContext();
					done(e);
				}
			}, chrono.secondsToMilliseconds(TTL) + 100);
		});
	});

	describe(`${MixedExpirationPolicy.prototype.onClear.name.magenta} spec`, () => {
		it('should stop timer when entries are cleared', (done) => {
			const ENTRIES = new Map<string, ExpirableCacheKeyedEntry<string, number>>([['a', { key: '', value: 1 }]]);

			const CONFIG: MixedExpirationPolicyConfig<string, number> = {
				checkInterval: 1,
				iterateThreshold: 1,
				getNextCacheEntry: createCacheEntriesCircularIterator(ENTRIES),
				getCacheSize: () => ENTRIES.size
			};
			const policy = new MixedExpirationPolicy<string, number>(CONFIG);

			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedKey, evictedEntry) => {
				ENTRIES.delete(evictedKey);
				EVICTED_KEYS.push(evictedKey);

				policy.onDelete(evictedKey, evictedEntry);
				expect((evictedEntry as ExpirableCacheEntry<number>)[EXPIRES_AT_SYM]).to.be.eq(undefined);
			});

			policy.onSet('a', ENTRIES.get('a')!, { expiresAfter: 1 });

			try {
				expect(policy.isIdle()).to.be.eq(false);
				policy.onClear();
				expect(policy.isIdle()).to.be.eq(true);
			} catch (e) {
				return done(e);
			}

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(0);
					done();
				} catch (e) {
					done(e);
				}
			}, 1050);
		});
	});
});

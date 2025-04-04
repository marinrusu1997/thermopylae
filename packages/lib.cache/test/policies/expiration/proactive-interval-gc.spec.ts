import { logger } from '@thermopylae/dev.unit-test';
import { buildPromiseHolder } from '@thermopylae/lib.async';
import { array, type types } from '@thermopylae/lib.utils';
import colors from 'colors';
import { convert } from 'convert';
import range from 'lodash.range';
import { randomInt } from 'node:crypto';
import randomItem from 'random-item';
import { describe, expect, it } from 'vitest';
import { EXPIRES_AT_SYM, INFINITE_EXPIRATION } from '../../../lib/constants.js';
import { EsMapCacheBackend, IntervalGarbageCollector, type IntervalGarbageCollectorOptions, ProactiveExpirationPolicy } from '../../../lib/index.js';
import type { ProactiveExpirableCacheEntry } from '../../../lib/policies/expiration/proactive.js';

describe(`${colors.magenta(ProactiveExpirationPolicy.name)} with ${IntervalGarbageCollector.name.magenta} spec`, () => {
	describe(`${ProactiveExpirationPolicy.prototype.onSet.name.magenta} spec`, () => {
		it('should iterate over entries with the given iteration step and evict all expired entries', { timeout: 2200 }, async () => {
			const CAPACITY = randomInt(1, 20);
			const KEYS = range(0, CAPACITY).map(String);

			const TTL = [1, 2];
			const KEY_TO_TTL = new Map<string, number>(
				(KEYS.map((key) => [key, randomItem(TTL)]) as [string, number][]).sort((first, second) => first[1] - second[1])
			);
			const KEY_TO_TTL_ENTRIES = [...KEY_TO_TTL];
			const KEYS_BY_TTL = {
				ONE_SECOND: KEY_TO_TTL_ENTRIES.filter((entry) => entry[1] === 1).map((entry) => entry[0]),
				TWO_SECOND: KEY_TO_TTL_ENTRIES.filter((entry) => entry[1] === 2).map((entry) => entry[0])
			};

			const BACKEND = new EsMapCacheBackend<string, number>();
			for (const key of KEY_TO_TTL.keys()) {
				BACKEND.set(key, Number(key));
			}

			const CONFIG: IntervalGarbageCollectorOptions<string, number> = {
				iterableBackend: BACKEND,
				checkInterval: 1,
				// oxlint-disable-next-line explicit-length-check
				iterateCount: KEYS_BY_TTL.ONE_SECOND.length || KEYS_BY_TTL.TWO_SECOND.length
			};
			const policy = new ProactiveExpirationPolicy<string, number>(new IntervalGarbageCollector(CONFIG));

			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);
				BACKEND.del(evictedEntry);

				policy.onDelete(evictedEntry as ProactiveExpirableCacheEntry<string, number>);
				expect((evictedEntry as ProactiveExpirableCacheEntry<string, number>)[EXPIRES_AT_SYM]).toBeUndefined();
				expect(evictedEntry.key).toBeUndefined();
				expect(evictedEntry.value).toBeUndefined();
			});

			function logTestContext() {
				const message = [
					'Test Context:',
					`${'CAPACITY'.magenta}\t\t: ${CAPACITY}`,
					`${'KEY_TO_TTL'.magenta}\t: ${JSON.stringify([...KEY_TO_TTL])}`,
					`${'KEYS_BY_TTL'.magenta}\t: ${JSON.stringify(KEYS_BY_TTL)}`,
					`${'CONFIG.iterateCount'.magenta}: ${CONFIG.iterateCount}`,
					`${'EVICTED_KEYS'.magenta}\t: ${JSON.stringify(EVICTED_KEYS)}`
				];

				logger.info(message.join('\n'));
			}

			for (const [key, entry] of BACKEND) {
				policy.onSet(entry as ProactiveExpirableCacheEntry<string, number>, { expiresAfter: KEY_TO_TTL.get(key) });
			}

			const deferred = buildPromiseHolder<void>();
			setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.have.length(KEYS_BY_TTL.ONE_SECOND.length);
					expect(EVICTED_KEYS).to.containSubset(KEYS_BY_TTL.ONE_SECOND);
				} catch (error) {
					logTestContext();
					clearTimeout(twoSecTtlTimeout);
					deferred.reject(error);
				}
			}, 1100);

			const twoSecTtlTimeout = setTimeout(() => {
				try {
					const expectedNumOfEvictedKeys = KEYS_BY_TTL.ONE_SECOND.length + Math.min(CONFIG.iterateCount ?? 0, KEYS_BY_TTL.TWO_SECOND.length);

					expect(EVICTED_KEYS).to.have.length(expectedNumOfEvictedKeys);

					if (KEYS_BY_TTL.TWO_SECOND.length > 0) {
						// we check for entries, because `containingAnyOf` with empty array will fail
						// also if we get here, it means at least 1 of the TWO_SECOND_TTL keys should be evicted
						let foundSomething = false;
						for (const twoSecondTtlKey of KEYS_BY_TTL.TWO_SECOND) {
							if (EVICTED_KEYS.includes(twoSecondTtlKey)) {
								foundSomething = true;
								break;
							}
						}
						expect(foundSomething).to.be.eq(true);
					}

					expect(policy.isIdle()).to.be.eq(expectedNumOfEvictedKeys === KEYS_BY_TTL.ONE_SECOND.length + KEYS_BY_TTL.TWO_SECOND.length);

					deferred.resolve();
				} catch (error) {
					logTestContext();
					deferred.reject(error);
				}
			}, 2100);

			await deferred.promise;
		});

		it('should restart GC after all entries were evicted', { timeout: 2500 }, async () => {
			const BACKEND = new EsMapCacheBackend<string, number>();
			BACKEND.set('key', 1);

			const CONFIG: IntervalGarbageCollectorOptions<string, number> = {
				iterableBackend: BACKEND,
				checkInterval: 1,
				iterateCount: 1
			};
			const policy = new ProactiveExpirationPolicy<string, number>(new IntervalGarbageCollector(CONFIG));

			const EVICTED_KEYS = new Set();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.add(evictedEntry.key);
				BACKEND.del(evictedEntry);

				policy.onDelete(evictedEntry as ProactiveExpirableCacheEntry<string, number>);
				expect((evictedEntry as ProactiveExpirableCacheEntry<string, number>)[EXPIRES_AT_SYM]).toBeUndefined();
				expect(evictedEntry.key).toBeUndefined();
				expect(evictedEntry.value).toBeUndefined();
			});

			const deferred = buildPromiseHolder<void>();

			policy.onSet(BACKEND.get('key') as ProactiveExpirableCacheEntry<string, number>, { expiresAfter: 1 });
			setTimeout(() => {
				try {
					expect(EVICTED_KEYS.has('key')).to.be.eq(true);
					expect(EVICTED_KEYS.size).to.be.eq(1);
					expect(BACKEND.size).to.be.eq(0);
					expect(policy.isIdle()).to.be.eq(true);

					const entry = BACKEND.set('second-key', 2) as ProactiveExpirableCacheEntry<string, number>;
					policy.onSet(entry, { expiresAfter: 1 });
					expect(policy.isIdle()).to.be.eq(false);
				} catch (error) {
					clearTimeout(timeoutAfterGcRestart);
					deferred.reject(error);
				}
			}, 1100);

			const timeoutAfterGcRestart = setTimeout(() => {
				try {
					expect(EVICTED_KEYS.has('second-key')).to.be.eq(true);
					expect(EVICTED_KEYS.size).to.be.eq(2);
					expect(BACKEND.size).to.be.eq(0);
					expect(policy.isIdle()).to.be.eq(true);

					deferred.resolve();
				} catch (error) {
					deferred.reject(error);
				}
			}, 2200);

			await deferred.promise;
		});
	});

	describe(`${ProactiveExpirationPolicy.prototype.onUpdate.name.magenta} spec`, () => {
		it('should update entry ttl and evict expired entries', async () => {
			const CAPACITY = randomInt(1, 10);
			const KEYS = range(0, CAPACITY).map(String);
			const TTL = 1;
			const KEYS_WITH_INFINITE_TTL = Array.from({ length: randomInt(1, CAPACITY + 1) }, array.randomUniqueItem(KEYS)) as string[];
			const KEY_TO_TTL = new Map<string, number>(KEYS.map((key) => [key, TTL]));
			const BACKEND = new EsMapCacheBackend<string, number>();

			// insert keys with ttl first, so they might be evicted
			for (const key of KEYS) {
				if (!KEYS_WITH_INFINITE_TTL.includes(key)) {
					BACKEND.set(key, Number(key));
				}
			}
			// insert keys without ttl second
			for (const key of KEYS_WITH_INFINITE_TTL) {
				BACKEND.set(key, Number(key));
			}

			const CONFIG: IntervalGarbageCollectorOptions<string, number> = {
				iterableBackend: BACKEND,
				checkInterval: 1,
				iterateCount: randomInt(1, CAPACITY + 1)
			};
			const policy = new ProactiveExpirationPolicy<string, number>(new IntervalGarbageCollector(CONFIG));

			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);
				BACKEND.del(evictedEntry);

				policy.onDelete(evictedEntry as ProactiveExpirableCacheEntry<string, number>);
				expect((evictedEntry as ProactiveExpirableCacheEntry<string, number>)[EXPIRES_AT_SYM]).toBeUndefined();
				expect(evictedEntry.key).toBeUndefined();
				expect(evictedEntry.value).toBeUndefined();
			});

			function logTestContext() {
				const message = [
					'Test Context:',
					`${'CAPACITY'.magenta}\t\t: ${CAPACITY}`,
					`${'KEY_TO_TTL'.magenta}\t: ${JSON.stringify([...KEY_TO_TTL])}`,
					`${'KEYS_WITH_INFINITE_TTL'.magenta}\t: ${JSON.stringify(KEYS_WITH_INFINITE_TTL)}`,
					`${'CONFIG.iterateCount'.magenta}: ${CONFIG.iterateCount}`,
					`${'EVICTED_KEYS'.magenta}\t: ${JSON.stringify(EVICTED_KEYS)}`
				];

				logger.info(message.join('\n'));
			}

			for (const [key, entry] of BACKEND) {
				policy.onSet(entry as ProactiveExpirableCacheEntry<string, number>, { expiresAfter: KEY_TO_TTL.get(key) });
			}
			for (const key of KEYS_WITH_INFINITE_TTL) {
				policy.onUpdate(BACKEND.get(key) as ProactiveExpirableCacheEntry<string, number>, { expiresAfter: INFINITE_EXPIRATION });
			}

			const deferred = buildPromiseHolder<void>();
			setTimeout(
				() => {
					try {
						const expectedEvictedKeys = KEYS.filter((key) => !KEYS_WITH_INFINITE_TTL.includes(key));
						const numberOfEvictedKeys = Math.min(expectedEvictedKeys.length, CONFIG.iterateCount ?? 0);

						expect(EVICTED_KEYS).to.have.length(numberOfEvictedKeys);

						if (expectedEvictedKeys.length > 0) {
							let foundSomething = false;
							for (const expectedEvictedKey of expectedEvictedKeys) {
								if (EVICTED_KEYS.includes(expectedEvictedKey)) {
									foundSomething = true;
									break;
								}
							}
							expect(foundSomething).to.be.eq(true); // at least some of them must be evicted
						}

						expect(policy.isIdle()).to.be.eq(BACKEND.size === 0);

						deferred.resolve();
					} catch (error) {
						logTestContext();
						deferred.reject(error);
					}
				},
				convert(TTL, 's').to('ms') + 100
			);

			await deferred.promise;
		});

		it('should do nothing when options or ttl from options are not given as arguments', async () => {
			const BACKEND = new EsMapCacheBackend<string, number>();
			const ENTRY = BACKEND.set('key', 1) as ProactiveExpirableCacheEntry<string, number>;

			const CONFIG: IntervalGarbageCollectorOptions<string, number> = {
				iterableBackend: BACKEND,
				checkInterval: 1,
				iterateCount: 1
			};
			const policy = new ProactiveExpirationPolicy<string, number>(new IntervalGarbageCollector(CONFIG));

			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);
				BACKEND.del(evictedEntry);

				policy.onDelete(evictedEntry as ProactiveExpirableCacheEntry<string, number>);
				expect((evictedEntry as ProactiveExpirableCacheEntry<string, number>)[EXPIRES_AT_SYM]).toBeUndefined();
				expect(evictedEntry.key).toBeUndefined();
				expect(evictedEntry.value).toBeUndefined();
			});

			policy.onUpdate(ENTRY, { expiresAfter: 1 });

			policy.onUpdate(ENTRY); // no options
			expect(EVICTED_KEYS.length).to.be.eq(0); // nothing evicted, yet
			policy.onUpdate(ENTRY, { expiresAfter: undefined }); // no ttl specified
			expect(EVICTED_KEYS.length).to.be.eq(0); // nothing evicted, yet
			policy.onUpdate(ENTRY, { expiresAfter: null as types.Any }); // no ttl specified
			expect(EVICTED_KEYS.length).to.be.eq(0); // nothing evicted, yet

			const deferred = buildPromiseHolder<void>();
			setTimeout(() => {
				try {
					expect(EVICTED_KEYS).toStrictEqual(['key']);
					expect(policy.isIdle()).to.be.eq(true);

					deferred.resolve();
				} catch (error) {
					deferred.reject(error);
				}
			}, 1100);
			await deferred.promise;
		});
	});

	describe(`${ProactiveExpirationPolicy.prototype.onClear.name.magenta} spec`, () => {
		it('should stop timer when entries are cleared', async () => {
			const BACKEND = new EsMapCacheBackend<string, number>();
			const ENTRY = BACKEND.set('a', 1) as ProactiveExpirableCacheEntry<string, number>;

			const CONFIG: IntervalGarbageCollectorOptions<string, number> = {
				iterableBackend: BACKEND,
				checkInterval: 1,
				iterateCount: 1
			};
			const policy = new ProactiveExpirationPolicy<string, number>(new IntervalGarbageCollector(CONFIG));

			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);
				BACKEND.del(evictedEntry);

				policy.onDelete(evictedEntry as ProactiveExpirableCacheEntry<string, number>);
				expect((evictedEntry as ProactiveExpirableCacheEntry<string, number>)[EXPIRES_AT_SYM]).toBeUndefined();
				expect(evictedEntry.key).toBeUndefined();
				expect(evictedEntry.value).toBeUndefined();
			});

			policy.onSet(ENTRY, { expiresAfter: 1 });

			expect(policy.isIdle()).to.be.eq(false);
			policy.onClear();
			expect(policy.isIdle()).to.be.eq(true);

			const deferred = buildPromiseHolder<void>();

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.have.length(0);
					deferred.resolve();
				} catch (error) {
					deferred.reject(error);
				}
			}, 1050);

			await deferred.promise;
		});
	});
});

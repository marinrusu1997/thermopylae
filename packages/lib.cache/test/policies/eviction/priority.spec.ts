import { describe, it } from 'mocha';
import colors from 'colors';
import { expect } from '@thermopylae/lib.unit-test';
import { chrono, number, string } from '@thermopylae/lib.utils';
import { CacheEntryPriority, PrioritizedCacheEntry, PRIORITY_SYM, PriorityEvictionPolicy } from '../../../lib/policies/eviction/priority';
import { EsMapCacheBackend } from '../../../lib';

describe(`${colors.magenta(PriorityEvictionPolicy.name)} spec`, () => {
	describe(`${PriorityEvictionPolicy.prototype.onSet.name.magenta} spec`, () => {
		it('should set entries with different priorities and evict them on low memory', (done) => {
			const CHECK_INTERVAL_SECONDS = 1;
			const TOTAL_ENTRIES_NO = 1200;

			const backend = new EsMapCacheBackend<string, string, PrioritizedCacheEntry<string, string>>();
			const policy = new PriorityEvictionPolicy<string, string>({
				iterableCacheBackend: backend,
				checkInterval: CHECK_INTERVAL_SECONDS,
				cacheEvictionPercentage: 0.7,
				criticalAvailableMemoryPercentage: 0.9 // force it to perform eviction
			});
			expect(policy.idle).to.be.eq(true);

			const EVICTED_ENTRIES = new Set<PrioritizedCacheEntry<string, string>>();
			policy.setDeleter((evictedEntry) => {
				const prioritizedEntry = evictedEntry as PrioritizedCacheEntry<string, string>;
				EVICTED_ENTRIES.add(prioritizedEntry);

				policy.onDelete(prioritizedEntry);
				expect(prioritizedEntry[PRIORITY_SYM]).to.be.eq(undefined);
			});

			function getPriority(index: number): CacheEntryPriority {
				switch (true) {
					case index < 200:
						return CacheEntryPriority.LOW;
					case index < 400:
						return CacheEntryPriority.BELOW_NORMAL;
					case index < 600:
						return CacheEntryPriority.NORMAL;
					case index < 800:
						return CacheEntryPriority.ABOVE_NORMAL;
					case index < 1000:
						return CacheEntryPriority.HIGH;
					default:
						return CacheEntryPriority.NOT_REMOVABLE;
				}
			}

			for (let i = 0; i < TOTAL_ENTRIES_NO; i++) {
				const key = String(i);
				const entry = backend.set(key, string.random()) as PrioritizedCacheEntry<string, string>;
				policy.onSet(entry, { priority: getPriority(i) });
			}

			setTimeout(() => {
				try {
					policy.onClear();
					expect(policy.idle).to.be.eq(true); // stop that interval timer

					expect(EVICTED_ENTRIES.size).to.be.eq(number.integerPercentage(TOTAL_ENTRIES_NO, 0.7));

					const statistics = {
						[CacheEntryPriority.LOW]: 0,
						[CacheEntryPriority.BELOW_NORMAL]: 0,
						[CacheEntryPriority.NORMAL]: 0,
						[CacheEntryPriority.ABOVE_NORMAL]: 0,
						[CacheEntryPriority.HIGH]: 0,
						[CacheEntryPriority.NOT_REMOVABLE]: 0
					};
					for (const entry of backend.values()) {
						statistics[entry[PRIORITY_SYM]] += 1;
					}

					expect(statistics[CacheEntryPriority.LOW]).to.be.eq(0);
					expect(statistics[CacheEntryPriority.BELOW_NORMAL]).to.be.eq(0);
					expect(statistics[CacheEntryPriority.NORMAL]).to.be.eq(0);
					expect(statistics[CacheEntryPriority.ABOVE_NORMAL]).to.be.eq(0);
					expect(statistics[CacheEntryPriority.HIGH]).to.be.eq(160);
					expect(statistics[CacheEntryPriority.NOT_REMOVABLE]).to.be.eq(200);

					done();
				} catch (e) {
					done(e);
				}
			}, chrono.secondsToMilliseconds(CHECK_INTERVAL_SECONDS) + 100);
		});

		it('should not evict entries that have NOT_REMOVABLE priority', (done) => {
			const backend = new EsMapCacheBackend<string, string, PrioritizedCacheEntry<string, string>>();
			const policy = new PriorityEvictionPolicy<string, string>({
				iterableCacheBackend: backend,
				checkInterval: 1,
				cacheEvictionPercentage: 0.9,
				criticalAvailableMemoryPercentage: 0.9 // force it to perform eviction
			});

			const EVICTED_ENTRIES = new Set<PrioritizedCacheEntry<string, string>>();
			policy.setDeleter((evictedEntry) => {
				const prioritizedEntry = evictedEntry as PrioritizedCacheEntry<string, string>;
				EVICTED_ENTRIES.add(prioritizedEntry);

				policy.onDelete(prioritizedEntry);
				expect(prioritizedEntry[PRIORITY_SYM]).to.be.eq(undefined);
			});

			policy.onSet(backend.set('a', 'a'), { priority: CacheEntryPriority.LOW });
			policy.onSet(backend.set('b', 'b'), { priority: CacheEntryPriority.BELOW_NORMAL });
			policy.onSet(backend.set('c', 'c'), { priority: CacheEntryPriority.NORMAL });
			policy.onSet(backend.set('d', 'd'), { priority: CacheEntryPriority.ABOVE_NORMAL });
			policy.onSet(backend.set('f', 'f'), { priority: CacheEntryPriority.NOT_REMOVABLE });
			policy.onSet(backend.set('e', 'e'), { priority: CacheEntryPriority.HIGH });
			policy.onSet(backend.set('g', 'g'), { priority: CacheEntryPriority.NOT_REMOVABLE });
			policy.onSet(backend.set('h', 'h'), { priority: CacheEntryPriority.NOT_REMOVABLE });

			setTimeout(() => {
				try {
					policy.onClear();
					expect(policy.idle).to.be.eq(true); // stop that interval timer

					expect(EVICTED_ENTRIES.size).to.be.eq(5);

					const statistics = {
						[CacheEntryPriority.LOW]: 0,
						[CacheEntryPriority.BELOW_NORMAL]: 0,
						[CacheEntryPriority.NORMAL]: 0,
						[CacheEntryPriority.ABOVE_NORMAL]: 0,
						[CacheEntryPriority.HIGH]: 0,
						[CacheEntryPriority.NOT_REMOVABLE]: 0
					};
					for (const entry of backend.values()) {
						statistics[entry[PRIORITY_SYM]] += 1;
					}

					expect(statistics[CacheEntryPriority.LOW]).to.be.eq(0);
					expect(statistics[CacheEntryPriority.BELOW_NORMAL]).to.be.eq(0);
					expect(statistics[CacheEntryPriority.NORMAL]).to.be.eq(0);
					expect(statistics[CacheEntryPriority.ABOVE_NORMAL]).to.be.eq(0);
					expect(statistics[CacheEntryPriority.HIGH]).to.be.eq(0);
					expect(statistics[CacheEntryPriority.NOT_REMOVABLE]).to.be.eq(3);

					done();
				} catch (e) {
					done(e);
				}
			}, 1100);
		});

		it('should evict nothing if there are only entries with NOT_REMOVABLE priority', (done) => {
			const backend = new EsMapCacheBackend<string, string, PrioritizedCacheEntry<string, string>>();
			const policy = new PriorityEvictionPolicy<string, string>({
				iterableCacheBackend: backend,
				checkInterval: 1,
				cacheEvictionPercentage: 1,
				criticalAvailableMemoryPercentage: 0.9 // force it to perform eviction
			});
			expect(policy.idle).to.be.eq(true);

			const EVICTED_ENTRIES = new Set<PrioritizedCacheEntry<string, string>>();
			policy.setDeleter((evictedEntry) => {
				const prioritizedEntry = evictedEntry as PrioritizedCacheEntry<string, string>;
				EVICTED_ENTRIES.add(prioritizedEntry);

				policy.onDelete(prioritizedEntry);
				expect(prioritizedEntry[PRIORITY_SYM]).to.be.eq(undefined);
			});

			policy.onSet(backend.set('a', 'a'), { priority: CacheEntryPriority.NOT_REMOVABLE });
			expect(policy.idle).to.be.eq(false);

			setTimeout(() => {
				try {
					expect(EVICTED_ENTRIES.size).to.be.eq(0);
					expect(policy.idle).to.be.eq(false);

					policy.onClear();
					expect(policy.idle).to.be.eq(true);

					done();
				} catch (e) {
					done(e);
				}
			}, 1100);
		});

		it('should stop eviction timer when all of the entries were evicted', (done) => {
			const backend = new EsMapCacheBackend<string, string, PrioritizedCacheEntry<string, string>>();
			const policy = new PriorityEvictionPolicy<string, string>({
				iterableCacheBackend: backend,
				checkInterval: 1,
				cacheEvictionPercentage: 1,
				criticalAvailableMemoryPercentage: 0.9 // force it to perform eviction
			});
			expect(policy.idle).to.be.eq(true);

			const EVICTED_KEYS = new Set<string>();
			policy.setDeleter((evictedEntry) => {
				const prioritizedEntry = evictedEntry as PrioritizedCacheEntry<string, string>;
				EVICTED_KEYS.add(prioritizedEntry.key);

				policy.onDelete(prioritizedEntry);
				backend.del(prioritizedEntry);
				expect(prioritizedEntry[PRIORITY_SYM]).to.be.eq(undefined);
				expect(prioritizedEntry.key).to.be.eq(undefined);
				expect(prioritizedEntry.value).to.be.eq(undefined);
			});

			policy.onSet(backend.set('a', 'a'), { priority: CacheEntryPriority.HIGH });
			expect(policy.idle).to.be.eq(false);

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS.size).to.be.eq(1);
					expect(EVICTED_KEYS.has('a')).to.be.eq(true);
					expect(policy.idle).to.be.eq(true);

					done();
				} catch (e) {
					done(e);
				}
			}, 1100);
		});
	});

	describe(`${PriorityEvictionPolicy.prototype.onUpdate.name.magenta} spec`, () => {
		it('should update entry priority and evict it later', (done) => {
			const backend = new EsMapCacheBackend<string, string, PrioritizedCacheEntry<string, string>>();
			const policy = new PriorityEvictionPolicy<string, string>({
				iterableCacheBackend: backend,
				checkInterval: 1,
				cacheEvictionPercentage: 0.5,
				criticalAvailableMemoryPercentage: 0.9 // force it to perform eviction
			});
			expect(policy.idle).to.be.eq(true);

			const EVICTED_ENTRIES = new Set<PrioritizedCacheEntry<string, string>>();
			policy.setDeleter((evictedEntry) => {
				const prioritizedEntry = evictedEntry as PrioritizedCacheEntry<string, string>;
				EVICTED_ENTRIES.add(prioritizedEntry);

				policy.onDelete(prioritizedEntry);
				expect(prioritizedEntry[PRIORITY_SYM]).to.be.eq(undefined);
			});

			policy.onSet(backend.set('a', 'a'), { priority: CacheEntryPriority.NOT_REMOVABLE });
			policy.onSet(backend.set('b', 'b'), { priority: CacheEntryPriority.HIGH });
			policy.onSet(backend.set('c', 'c'), { priority: CacheEntryPriority.NORMAL });
			policy.onSet(backend.set('d', 'd'), { priority: CacheEntryPriority.LOW });

			policy.onUpdate(backend.get('a')!, { priority: CacheEntryPriority.LOW });
			policy.onUpdate(backend.get('d')!, { priority: CacheEntryPriority.NOT_REMOVABLE });

			policy.onUpdate(backend.get('b')!); // has no effect
			policy.onUpdate(backend.get('b')!, { priority: undefined }); // has no effect
			policy.onUpdate(backend.get('b')!, { priority: null! }); // has no effect
			policy.onUpdate(backend.get('c')!, { priority: CacheEntryPriority.NORMAL }); // has no effect, same priority

			setTimeout(() => {
				try {
					policy.onClear();
					expect(policy.idle).to.be.eq(true); // stop that interval timer

					expect(EVICTED_ENTRIES.size).to.be.eq(2);
					expect(EVICTED_ENTRIES.has(backend.get('a')!)).to.be.eq(true);
					expect(EVICTED_ENTRIES.has(backend.get('c')!)).to.be.eq(true);

					const statistics = {
						[CacheEntryPriority.LOW]: 0,
						[CacheEntryPriority.BELOW_NORMAL]: 0,
						[CacheEntryPriority.NORMAL]: 0,
						[CacheEntryPriority.ABOVE_NORMAL]: 0,
						[CacheEntryPriority.HIGH]: 0,
						[CacheEntryPriority.NOT_REMOVABLE]: 0
					};
					for (const entry of backend.values()) {
						statistics[entry[PRIORITY_SYM]] += 1;
					}

					expect(statistics[CacheEntryPriority.LOW]).to.be.eq(0);
					expect(statistics[CacheEntryPriority.BELOW_NORMAL]).to.be.eq(0);
					expect(statistics[CacheEntryPriority.NORMAL]).to.be.eq(0);
					expect(statistics[CacheEntryPriority.ABOVE_NORMAL]).to.be.eq(0);
					expect(statistics[CacheEntryPriority.HIGH]).to.be.eq(1);
					expect(statistics[CacheEntryPriority.NOT_REMOVABLE]).to.be.eq(1);

					done();
				} catch (e) {
					done(e);
				}
			}, 1100);
		});
	});

	describe(`${PriorityEvictionPolicy.prototype.onDelete.name.magenta} spec`, () => {
		it('should stop eviction timer when all of the entries were deleted', () => {
			const backend = new EsMapCacheBackend<string, string, PrioritizedCacheEntry<string, string>>();
			const policy = new PriorityEvictionPolicy<string, string>({
				iterableCacheBackend: backend,
				checkInterval: 1,
				cacheEvictionPercentage: 0.5,
				criticalAvailableMemoryPercentage: 0.9 // force it to perform eviction
			});
			expect(policy.idle).to.be.eq(true);

			policy.onSet(backend.set('a', 'a'), { priority: CacheEntryPriority.NOT_REMOVABLE });
			expect(policy.idle).to.be.eq(false);

			policy.onDelete(backend.get('a')!);
			expect(policy.idle).to.be.eq(true);
		});
	});

	describe(`${PriorityEvictionPolicy.prototype.onClear.name.magenta} spec`, () => {
		it('restarts eviction timer after clearing and evicts entries added after', (done) => {
			const backend = new EsMapCacheBackend<string, string, PrioritizedCacheEntry<string, string>>();
			const policy = new PriorityEvictionPolicy<string, string>({
				iterableCacheBackend: backend,
				checkInterval: 1,
				cacheEvictionPercentage: 0.7,
				criticalAvailableMemoryPercentage: 0.9 // force it to perform eviction
			});
			expect(policy.idle).to.be.eq(true);

			const EVICTED_KEYS = new Set<string>();
			policy.setDeleter((evictedEntry) => {
				const prioritizedEntry = evictedEntry as PrioritizedCacheEntry<string, string>;
				EVICTED_KEYS.add(prioritizedEntry.key);

				policy.onDelete(prioritizedEntry);
				backend.del(prioritizedEntry);
				expect(prioritizedEntry[PRIORITY_SYM]).to.be.eq(undefined);
				expect(prioritizedEntry.key).to.be.eq(undefined);
				expect(prioritizedEntry.value).to.be.eq(undefined);
			});

			policy.onSet(backend.set('a', 'a'), { priority: CacheEntryPriority.NOT_REMOVABLE });
			expect(policy.idle).to.be.eq(false);

			backend.clear();
			policy.onClear();
			expect(policy.idle).to.be.eq(true);
			expect(EVICTED_KEYS.size).to.be.eq(0);

			policy.onSet(backend.set('b', 'b'), { priority: CacheEntryPriority.HIGH });
			policy.onSet(backend.set('c', 'c'), { priority: CacheEntryPriority.NORMAL });

			setTimeout(() => {
				try {
					policy.onClear();
					expect(policy.idle).to.be.eq(true); // stop that interval timer

					expect(EVICTED_KEYS.size).to.be.eq(1);
					expect(EVICTED_KEYS.has('c')).to.be.eq(true);

					expect(backend.size).to.be.eq(1);
					expect(backend.has('b')).to.be.eq(true);

					done();
				} catch (e) {
					done(e);
				}
			}, 1100);
		});
	});
});

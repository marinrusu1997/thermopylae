import { logger } from '@thermopylae/dev.unit-test';
import { buildPromiseHolder } from '@thermopylae/lib.async';
import { array, number, string } from '@thermopylae/lib.utils';
import colors from 'colors';
import range from 'lodash.range';
import { describe, expect, it } from 'vitest';
import { NEXT_SYM, PREV_SYM } from '../../../lib/data-structures/list/doubly-linked.js';
import { type EvictableCacheEntry, SEGMENT_SYM, SegmentedLRUEvictionPolicy } from '../../../lib/policies/eviction/segmented-lru.js';
import { MapUtils } from '../../utils.js';

describe(`${colors.magenta(SegmentedLRUEvictionPolicy.name)} spec`, () => {
	it('should work under minimal cache capacity', async () => {
		const CAPACITY = 2;
		const PROTECTED_SEGMENT_RATIO = 0.5;

		const ENTRIES_IN_CACHE = new Map<string, EvictableCacheEntry<string, number>>();
		let HOPS = 50;

		const deferred = buildPromiseHolder<void>();

		try {
			const policy = new SegmentedLRUEvictionPolicy<string, number, any>(CAPACITY, PROTECTED_SEGMENT_RATIO);
			policy.setDeleter((evictedEntry) => {
				ENTRIES_IN_CACHE.delete(evictedEntry.key);

				const evictableKeyNode = evictedEntry as EvictableCacheEntry<string, number>;
				policy.onDelete(evictableKeyNode);
				expect(evictableKeyNode[NEXT_SYM]).to.be.eq(null);
				expect(evictableKeyNode[PREV_SYM]).to.be.eq(null);
				expect(evictableKeyNode[SEGMENT_SYM]).to.be.eq(undefined);
			});

			const onSetInterval = setInterval(() => {
				if (isDone()) {
					return;
				}
				const key = string.random({ length: 2, allowedCharRegex: /[0-9]/ });
				const entry: EvictableCacheEntry<string, number> = {
					key,
					value: Number(key),
					// @ts-expect-error This is for testing purposes
					[SEGMENT_SYM]: null
				};

				policy.onSet(entry);
				ENTRIES_IN_CACHE.set(key, entry);
			}, 5);

			const onHitInterval = setInterval(() => {
				if (isDone() || !ENTRIES_IN_CACHE.size) {
					return;
				}
				const entry = array.randomElement(Array.from(ENTRIES_IN_CACHE.values()));
				policy.onHit(entry);
			}, 2);

			const isDone = (): boolean => {
				if (--HOPS === 0) {
					try {
						clearInterval(onSetInterval);
						clearInterval(onHitInterval);

						expect(policy.size).to.be.eq(CAPACITY);
						// this might happen when onHit has been called, it evicted entry, but next onSet hadn't chance to be called to insert a new one
						expect(ENTRIES_IN_CACHE.size).to.be.within(CAPACITY - 1, CAPACITY);

						deferred.resolve();
					} catch (e) {
						deferred.reject(e);
					} finally {
						return true;
					}
				}
				return false;
			};

			await deferred.promise;
		} catch (e) {
			const message = [
				'Test Context:',
				`${'CAPACITY'.magenta}\t\t: ${CAPACITY}`,
				`${'PROTECTED_SEGMENT_RATIO'.magenta}: ${PROTECTED_SEGMENT_RATIO}`,
				'',
				`${'ENTRIES_IN_CACHE'.magenta}\t: ${JSON.stringify([...ENTRIES_IN_CACHE])}`,
				`${'HOPS'.magenta}\t\t: ${HOPS}`
			];
			logger.info(message.join('\n'));
			throw e;
		}
	});

	it('should work as a simple LRU when no hits are performed', () => {
		const CAPACITY = number.randomInt(3, 10);
		const PROTECTED_OVER_PROBATION_RATIO = 0.5;

		const PROTECTED_SIZE = Math.round(number.percentage(CAPACITY, PROTECTED_OVER_PROBATION_RATIO));
		const PROBATION_SIZE = CAPACITY - PROTECTED_SIZE;

		const ENTRIES = new Map<string, EvictableCacheEntry<string, number>>(
			range(0, PROBATION_SIZE).map((value) => {
				const entry: EvictableCacheEntry<string, number> = {
					key: String(value),
					value,
					// @ts-expect-error This is for testing purposes
					[SEGMENT_SYM]: null
				};
				return [entry.key, entry];
			})
		);
		const ADDITIONAL_ENTRIES = new Map<string, EvictableCacheEntry<string, number>>(
			range(PROBATION_SIZE, number.randomInt(1, PROBATION_SIZE)).map((value) => {
				const entry: EvictableCacheEntry<string, number> = {
					key: String(value),
					value,
					// @ts-expect-error This is for testing purposes
					[SEGMENT_SYM]: null
				};
				return [entry.key, entry];
			})
		);

		const EVICTED_KEYS = new Array<string>();

		try {
			const policy = new SegmentedLRUEvictionPolicy<string, number, any>(CAPACITY, PROTECTED_OVER_PROBATION_RATIO);
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);

				const evictableKeyNode = evictedEntry as EvictableCacheEntry<string, number>;
				policy.onDelete(evictableKeyNode);
				expect(evictableKeyNode[NEXT_SYM]).to.be.eq(null);
				expect(evictableKeyNode[PREV_SYM]).to.be.eq(null);
				expect(evictableKeyNode[SEGMENT_SYM]).to.be.eq(undefined);
			});

			for (const entry of ENTRIES.values()) {
				policy.onSet(entry);
			}

			for (const entry of ADDITIONAL_ENTRIES.values()) {
				policy.onSet(entry);
			}

			expect(EVICTED_KEYS).to.have.length(ADDITIONAL_ENTRIES.size);

			const ENTRIES_AS_ARRAY = [...ENTRIES];
			for (let i = 0; i < ADDITIONAL_ENTRIES.size; i++) {
				expect(EVICTED_KEYS[i]).to.be.eq(ENTRIES_AS_ARRAY[i][0]);
			}
		} catch (e) {
			const message = [
				'Test Context:',
				`${'CAPACITY'.magenta}\t\t: ${CAPACITY}`,
				`${'PROTECTED_OVER_PROBATION_RATIO'.magenta}: ${PROTECTED_OVER_PROBATION_RATIO}`,
				`${'PROTECTED_SIZE'.magenta}\t: ${PROTECTED_SIZE}`,
				`${'PROBATION_SIZE'.magenta}\t: ${PROBATION_SIZE}`,
				'',
				`${'ENTRIES'.magenta}\t\t: ${JSON.stringify([...ENTRIES])}`,
				`${'ADDITIONAL_ENTRIES'.magenta}: ${JSON.stringify([...ADDITIONAL_ENTRIES])}`,
				'',
				`${'EVICTED_KEYS'.magenta}\t: ${JSON.stringify(EVICTED_KEYS)}`
			];
			logger.info(message.join('\n'));
			throw e;
		}
	});

	it('should evict entries in the right order', () => {
		const CAPACITY = number.randomInt(3, 20);
		const PROTECTED_OVER_PROBATION_RATIO = 0.5;

		const PROTECTED_SIZE = Math.round(number.percentage(CAPACITY, PROTECTED_OVER_PROBATION_RATIO));
		const PROBATION_SIZE = CAPACITY - PROTECTED_SIZE;

		const PROTECTED_ENTRIES = new Map<string, EvictableCacheEntry<string, number>>(
			range(0, PROTECTED_SIZE).map((value) => {
				const entry: EvictableCacheEntry<string, number> = {
					key: String(value),
					value,
					// @ts-expect-error This is for testing purposes
					[SEGMENT_SYM]: null
				};
				return [entry.key, entry];
			})
		);
		const PROBATION_ENTRIES = new Map<string, EvictableCacheEntry<string, number>>(
			range(0, PROBATION_SIZE).map((value) => {
				value += PROTECTED_SIZE; // to generate distinct key-values from PROTECTED SEGMENT

				const entry: EvictableCacheEntry<string, number> = {
					key: String(value),
					value,
					// @ts-expect-error This is for testing purposes
					[SEGMENT_SYM]: null
				};
				return [entry.key, entry];
			})
		);

		const EVICTED_KEYS = new Array<string>();

		try {
			const policy = new SegmentedLRUEvictionPolicy<string, number, any>(CAPACITY, PROTECTED_OVER_PROBATION_RATIO);
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);

				const evictableKeyNode = evictedEntry as EvictableCacheEntry<string, number>;
				policy.onDelete(evictableKeyNode);
				expect(evictableKeyNode[NEXT_SYM]).to.be.eq(null);
				expect(evictableKeyNode[PREV_SYM]).to.be.eq(null);
				expect(evictableKeyNode[SEGMENT_SYM]).to.be.eq(undefined);
			});

			// 1. Insert protected items
			for (const entry of PROTECTED_ENTRIES.values()) {
				policy.onSet(entry);
				policy.onHit(entry);
			}
			const mostRecentEntry = MapUtils.lastEntry(PROTECTED_ENTRIES)![1];
			const leastRecentEntry = MapUtils.firstEntry(PROTECTED_ENTRIES)![1];
			expect(policy.mostRecent).to.be.eq(mostRecentEntry);
			expect(policy.leastRecent).to.be.eq(leastRecentEntry);

			// 2. Insert probation items
			for (const entry of PROBATION_ENTRIES.values()) {
				policy.onSet(entry);
			}
			expect(policy.size).to.be.eq(CAPACITY); // full

			// 3. onHit for probation tail
			const probationTail = MapUtils.firstEntry(PROBATION_ENTRIES)![1];
			policy.onHit(probationTail);
			expect(policy.mostRecent).to.be.eq(probationTail);
			expect(policy.size).to.be.eq(CAPACITY); // full
			expect(EVICTED_KEYS).to.have.length(0);

			// 4. onHit for probation head
			const probationHead = leastRecentEntry;
			policy.onHit(probationHead);
			expect(policy.mostRecent).to.be.eq(probationHead);
			expect(policy.size).to.be.eq(CAPACITY); // full
			expect(EVICTED_KEYS).to.have.length(0);

			// 5. onHit for protected head
			const protectedHead = leastRecentEntry;
			policy.onHit(protectedHead);
			expect(policy.mostRecent).to.be.eq(protectedHead);
			expect(policy.size).to.be.eq(CAPACITY); // full
			expect(EVICTED_KEYS).to.have.length(0);

			// 6. onHit for protected tail
			const protectedTail = policy.leastRecent!;
			policy.onHit(protectedTail);
			expect(policy.mostRecent).to.be.eq(protectedTail);
			expect(policy.size).to.be.eq(CAPACITY); // full
			expect(EVICTED_KEYS).to.have.length(0);

			// 7. onSet
			const protectedTailBeforeSet = policy.leastRecent;

			const entry: EvictableCacheEntry<string, number> = {
				key: string.random(),
				value: number.random(CAPACITY, CAPACITY + 10),
				// @ts-ignore This is for testing purposes
				[SEGMENT_SYM]: null
			};
			policy.onSet(entry);
			expect(policy.size).to.be.eq(CAPACITY); // full
			expect(EVICTED_KEYS).to.have.length(1);
			expect(policy.mostRecent).to.be.eq(protectedTail); // protected remained untouched
			expect(policy.leastRecent).to.be.eq(protectedTailBeforeSet); // protected remained untouched

			// 8. onHit for last inserted entry
			policy.onHit(entry);
			expect(policy.size).to.be.eq(CAPACITY); // full
			expect(EVICTED_KEYS).to.have.length(1);
			expect(policy.mostRecent).to.be.eq(entry);
		} catch (e) {
			const message = [
				'Test Context:',
				`${'CAPACITY'.magenta}\t\t: ${CAPACITY}`,
				`${'PROTECTED_OVER_PROBATION_RATIO'.magenta}: ${PROTECTED_OVER_PROBATION_RATIO}`,
				`${'PROTECTED_SIZE'.magenta}\t: ${PROTECTED_SIZE}`,
				`${'PROBATION_SIZE'.magenta}\t: ${PROBATION_SIZE}`,
				'',
				`${'PROTECTED_ENTRIES'.magenta}: ${JSON.stringify([...PROTECTED_ENTRIES])}`,
				`${'PROBATION_ENTRIES'.magenta}: ${JSON.stringify([...PROBATION_ENTRIES])}`,
				'',
				`${'EVICTED_KEYS'.magenta}\t: ${JSON.stringify(EVICTED_KEYS)}`
			];
			logger.info(message.join('\n'));
			throw e;
		}
	});

	it('should delete entries', () => {
		const CAPACITY = 2;
		const EVICTED_KEYS = new Array<string>();
		const policy = new SegmentedLRUEvictionPolicy<string, number, any>(CAPACITY, 0.5);
		policy.setDeleter((evictedEntry) => {
			EVICTED_KEYS.push(evictedEntry.key);

			const evictableKeyNode = evictedEntry as EvictableCacheEntry<string, number>;
			policy.onDelete(evictableKeyNode);
			expect(evictableKeyNode[NEXT_SYM]).to.be.eq(null);
			expect(evictableKeyNode[PREV_SYM]).to.be.eq(null);
			expect(evictableKeyNode[SEGMENT_SYM]).to.be.eq(undefined);
		});

		const firstEntry: EvictableCacheEntry<string, number> = {
			key: 'a',
			value: 1,
			// @ts-ignore This is for testing purposes
			[SEGMENT_SYM]: null
		};
		const secondEntry: EvictableCacheEntry<string, number> = {
			key: 'b',
			value: 2,
			// @ts-ignore This is for testing purposes
			[SEGMENT_SYM]: null
		};

		// 1. Set entries
		policy.onSet(firstEntry);
		policy.onHit(firstEntry); // move to protected
		policy.onSet(secondEntry);
		expect(policy.size).to.be.eq(CAPACITY);

		// 2. Delete them one by one
		policy.onDelete(firstEntry);
		expect(policy.size).to.be.eq(CAPACITY - 1);
		policy.onDelete(secondEntry);
		expect(policy.size).to.be.eq(CAPACITY - 2);

		// 3. Set them back
		policy.onSet(firstEntry);
		policy.onHit(firstEntry); // move to protected
		policy.onSet(secondEntry);
		expect(policy.size).to.be.eq(CAPACITY);

		// 4. Clear them
		policy.onClear();
		expect(policy.size).to.be.eq(0);
	});
});

import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import { UnitTestLogger } from '@thermopylae/lib.unit-test/dist/logger';
import { array, number, string } from '@thermopylae/lib.utils';
import colors from 'colors';
import range from 'lodash.range';
import { SegmentedLRUPolicy, EvictableKeyNode, SEGMENT_SYM } from '../../../lib/policies/eviction/segmented-lru';
import { MapUtils } from '../../utils';

describe(`${colors.magenta(SegmentedLRUPolicy.name)} spec`, () => {
	it('should work under minimal cache capacity', (done) => {
		const CAPACITY = 2;
		const PROTECTED_SEGMENT_RATIO = 0.5;

		const ENTRIES_IN_CACHE = new Map<string, EvictableKeyNode<string, number>>();
		let HOPS = 50;

		try {
			const policy = new SegmentedLRUPolicy<string, number>(CAPACITY, PROTECTED_SEGMENT_RATIO);
			policy.setDeleter((key) => {
				ENTRIES_IN_CACHE.delete(key);
			});

			const onSetInterval = setInterval(() => {
				if (isDone()) {
					return;
				}
				const key = string.random({ length: 2, allowedCharRegex: /[0-9]/ });
				const entry: EvictableKeyNode<string, number> = {
					key,
					value: Number(key),
					// @ts-expect-error
					[SEGMENT_SYM]: null
				};

				policy.onSet(key, entry);
				ENTRIES_IN_CACHE.set(key, entry);
			}, 5);

			const onHitInterval = setInterval(() => {
				if (isDone() || !ENTRIES_IN_CACHE.size) {
					return;
				}
				const [key, entry] = array.randomElement(Array.from(ENTRIES_IN_CACHE));
				policy.onHit(key, entry);
			}, 2);

			const isDone = (): boolean => {
				if (--HOPS === 0) {
					try {
						clearInterval(onSetInterval);
						clearInterval(onHitInterval);

						expect(policy.size).to.be.eq(CAPACITY);
						// this might happen when onHit has been called, it evicted entry, but next onSet hadn't chance to be called to insert a new one
						expect(ENTRIES_IN_CACHE.size).to.be.within(CAPACITY - 1, CAPACITY);

						done();
					} catch (e) {
						done(e);
					} finally {
						// eslint-disable-next-line no-unsafe-finally
						return true;
					}
				}
				return false;
			};
		} catch (e) {
			const message = [
				'Test Context:',
				`${'CAPACITY'.magenta}\t\t: ${CAPACITY}`,
				`${'PROTECTED_SEGMENT_RATIO'.magenta}: ${PROTECTED_SEGMENT_RATIO}`,
				'',
				`${'ENTRIES_IN_CACHE'.magenta}\t: ${JSON.stringify([...ENTRIES_IN_CACHE])}`,
				`${'HOPS'.magenta}\t\t: ${HOPS}`
			];
			UnitTestLogger.info(message.join('\n'));
			throw e;
		}
	});

	it('should work as a simple LRU when no hits are performed', () => {
		const CAPACITY = number.randomInt(3, 10);
		const PROTECTED_OVER_PROBATION_RATIO = 0.5;

		const PROTECTED_SIZE = Math.round(number.percentage(CAPACITY, PROTECTED_OVER_PROBATION_RATIO));
		const PROBATION_SIZE = CAPACITY - PROTECTED_SIZE;

		const ENTRIES = new Map<string, EvictableKeyNode<string, number>>(
			range(0, PROBATION_SIZE).map((value) => {
				const entry: EvictableKeyNode<string, number> = {
					key: String(value),
					value,
					// @ts-expect-error
					[SEGMENT_SYM]: null
				};
				return [entry.key, entry];
			})
		);
		const ADDITIONAL_ENTRIES = new Map<string, EvictableKeyNode<string, number>>(
			range(PROBATION_SIZE, number.randomInt(1, PROBATION_SIZE)).map((value) => {
				const entry: EvictableKeyNode<string, number> = {
					key: String(value),
					value,
					// @ts-expect-error
					[SEGMENT_SYM]: null
				};
				return [entry.key, entry];
			})
		);

		const EVICTED_KEYS = new Array<string>();

		try {
			const policy = new SegmentedLRUPolicy<string, number>(CAPACITY, PROTECTED_OVER_PROBATION_RATIO);
			policy.setDeleter((key) => EVICTED_KEYS.push(key));

			for (const [key, entry] of ENTRIES) {
				policy.onSet(key, entry);
			}

			for (const [key, entry] of ADDITIONAL_ENTRIES) {
				policy.onSet(key, entry);
			}

			expect(EVICTED_KEYS).to.be.ofSize(ADDITIONAL_ENTRIES.size);

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
			UnitTestLogger.info(message.join('\n'));
			throw e;
		}
	});

	it('should evict entries in the right order', () => {
		const CAPACITY = number.randomInt(3, 20);
		const PROTECTED_OVER_PROBATION_RATIO = 0.5;

		const PROTECTED_SIZE = Math.round(number.percentage(CAPACITY, PROTECTED_OVER_PROBATION_RATIO));
		const PROBATION_SIZE = CAPACITY - PROTECTED_SIZE;

		const PROTECTED_ENTRIES = new Map<string, EvictableKeyNode<string, number>>(
			range(0, PROTECTED_SIZE).map((value) => {
				const entry: EvictableKeyNode<string, number> = {
					key: String(value),
					value,
					// @ts-expect-error
					[SEGMENT_SYM]: null
				};
				return [entry.key, entry];
			})
		);
		const PROBATION_ENTRIES = new Map<string, EvictableKeyNode<string, number>>(
			range(0, PROBATION_SIZE).map((value) => {
				value += PROTECTED_SIZE; // to generate distinct key-values from PROTECTED SEGMENT

				const entry: EvictableKeyNode<string, number> = {
					key: String(value),
					value,
					// @ts-expect-error
					[SEGMENT_SYM]: null
				};
				return [entry.key, entry];
			})
		);

		const EVICTED_KEYS = new Array<string>();

		try {
			const policy = new SegmentedLRUPolicy<string, number>(CAPACITY, PROTECTED_OVER_PROBATION_RATIO);
			policy.setDeleter((key) => EVICTED_KEYS.push(key));

			// 1. Insert protected items
			for (const [key, entry] of PROTECTED_ENTRIES) {
				policy.onSet(key, entry);
				policy.onHit(key, entry);
			}
			const mostRecentEntry = MapUtils.lastEntry(PROTECTED_ENTRIES)![1];
			const leastRecentEntry = MapUtils.firstEntry(PROTECTED_ENTRIES)![1];
			expect(policy.mostRecent).to.be.eq(mostRecentEntry);
			expect(policy.leastRecent).to.be.eq(leastRecentEntry);

			// 2. Insert probation items
			for (const [key, entry] of PROBATION_ENTRIES) {
				policy.onSet(key, entry);
			}
			expect(policy.size).to.be.eq(CAPACITY); // full

			// 3. onHit for probation tail
			const probationTail = MapUtils.firstEntry(PROBATION_ENTRIES)![1];
			policy.onHit(probationTail.key, probationTail);
			expect(policy.mostRecent).to.be.eq(probationTail);
			expect(policy.size).to.be.eq(CAPACITY); // full
			expect(EVICTED_KEYS).to.be.ofSize(0);

			// 4. onHit for probation head
			const probationHead = leastRecentEntry;
			policy.onHit(probationHead.key, probationHead);
			expect(policy.mostRecent).to.be.eq(probationHead);
			expect(policy.size).to.be.eq(CAPACITY); // full
			expect(EVICTED_KEYS).to.be.ofSize(0);

			// 5. onHit for protected head
			const protectedHead = leastRecentEntry;
			policy.onHit(protectedHead.key, protectedHead);
			expect(policy.mostRecent).to.be.eq(protectedHead);
			expect(policy.size).to.be.eq(CAPACITY); // full
			expect(EVICTED_KEYS).to.be.ofSize(0);

			// 6. onHit for protected tail
			const protectedTail = policy.leastRecent!;
			policy.onHit(protectedTail.key, protectedTail);
			expect(policy.mostRecent).to.be.eq(protectedTail);
			expect(policy.size).to.be.eq(CAPACITY); // full
			expect(EVICTED_KEYS).to.be.ofSize(0);

			// 7. onSet
			const protectedTailBeforeSet = policy.leastRecent;

			const entry: EvictableKeyNode<string, number> = {
				key: string.random(),
				value: number.random(CAPACITY, CAPACITY + 10),
				// @ts-ignore
				[SEGMENT_SYM]: null
			};
			policy.onSet(entry.key, entry);
			expect(policy.size).to.be.eq(CAPACITY); // full
			expect(EVICTED_KEYS).to.be.ofSize(1);
			expect(policy.mostRecent).to.be.eq(protectedTail); // protected remained untouched
			expect(policy.leastRecent).to.be.eq(protectedTailBeforeSet); // protected remained untouched

			// 8. onHit for last inserted entry
			policy.onHit(entry.key, entry);
			expect(policy.size).to.be.eq(CAPACITY); // full
			expect(EVICTED_KEYS).to.be.ofSize(1);
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
			UnitTestLogger.info(message.join('\n'));
			throw e;
		}
	});

	it('should delete entries', () => {
		const CAPACITY = 2;
		const EVICTED_KEYS = new Array<string>();
		const policy = new SegmentedLRUPolicy<string, number>(CAPACITY, 0.5);
		policy.setDeleter((key) => EVICTED_KEYS.push(key));

		const firstEntry: EvictableKeyNode<string, number> = {
			key: 'a',
			value: 1,
			// @ts-ignore
			[SEGMENT_SYM]: null
		};
		const secondEntry: EvictableKeyNode<string, number> = {
			key: 'b',
			value: 2,
			// @ts-ignore
			[SEGMENT_SYM]: null
		};

		// 1. Set entries
		policy.onSet(firstEntry.key, firstEntry);
		policy.onHit(firstEntry.key, firstEntry); // move to protected
		policy.onSet(secondEntry.key, secondEntry);
		expect(policy.size).to.be.eq(CAPACITY);

		// 2. Delete them one by one
		policy.onDelete(firstEntry.key, firstEntry);
		expect(policy.size).to.be.eq(CAPACITY - 1);
		policy.onDelete(secondEntry.key, secondEntry);
		expect(policy.size).to.be.eq(CAPACITY - 2);

		// 3. Set them back
		policy.onSet(firstEntry.key, firstEntry);
		policy.onHit(firstEntry.key, firstEntry); // move to protected
		policy.onSet(secondEntry.key, secondEntry);
		expect(policy.size).to.be.eq(CAPACITY);

		// 4. Clear them
		policy.onClear();
		expect(policy.size).to.be.eq(0);
	});

	it('requires entry on deletion', () => {
		const policy = new SegmentedLRUPolicy<string, number>(2, 0.5);
		expect(policy.requiresEntryOnDeletion).to.be.eq(true);
	});
});

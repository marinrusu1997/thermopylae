import type { Nullable } from '@thermopylae/core.declarations';
import { logger } from '@thermopylae/dev.unit-test';
import colors from 'colors';
// @ts-expect-error This package has no typingsypings
import gc from 'js-gc';
import shuffle from 'knuth-shuffle-seeded';
import range from 'lodash.range';
import { randomInt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BUCKET_HEADER_SYM } from '../../../lib/data-structures/bucket-list/ordered-bucket-list.js';
import { NEXT_SYM, PREV_SYM } from '../../../lib/data-structures/list/doubly-linked.js';
import { GDSFEvictionPolicy, LFUDAEvictionPolicy, LFUEvictionPolicy } from '../../../lib/index.js';
import { BaseLFUEvictionPolicy, type EvictableCacheEntry } from '../../../lib/policies/eviction/lfu-base.js';
import { ReverseMap } from '../../utils.js';

// const BUCKET_FORMATTERS = [colors.magenta, colors.green, colors.blue, colors.red];
const LFU_IMPLS = [LFUEvictionPolicy, LFUDAEvictionPolicy, GDSFEvictionPolicy];

function lfuFactory<Key, Value, ArgumentsBundle = unknown>(
	constructor: typeof BaseLFUEvictionPolicy,
	...constructorParams: ConstructorParameters<typeof LFUEvictionPolicy>
): BaseLFUEvictionPolicy<Key, Value, ArgumentsBundle> {
	// @ts-expect-error This is for testing purposesrposes
	return new constructor(...constructorParams);
}

describe(`${colors.magenta(BaseLFUEvictionPolicy.name)} spec`, () => {
	describe.each(LFU_IMPLS)('LFU Implementations spec', (LFU_IMPL) => {
		describe(`${LFU_IMPL.name.magenta} spec`, () => {
			describe(`${LFU_IMPL.prototype.onHit.name.magenta} & ${LFU_IMPL.prototype.onSet.name.magenta} spec`, () => {
				it('should not evict entries until capacity cap is met', () => {
					expect.hasAssertions();

					const CAPACITY = randomInt(1, 11);
					try {
						let totalEntriesNo = 0;

						const policy = lfuFactory<string, number>(LFU_IMPL, CAPACITY, {
							get size() {
								return totalEntriesNo;
							}
						});
						const candidates = new Map<string, number>();
						for (let i = 0; i < CAPACITY; i++) {
							candidates.set(String(i), i);
						}

						for (const [key, value] of candidates) {
							// @ts-expect-error This is for testing purposesrposes
							const entry: EvictableCacheEntry<string, number> = { key, value };
							policy.onSet(entry);
							totalEntriesNo += 1;

							expect(policy.size).to.be.eq(totalEntriesNo); // stacks up entries
						}

						// @ts-expect-error This is for testing purposesrposes
						const entry: EvictableCacheEntry<string, number> = { key: String(CAPACITY + 1), value: CAPACITY + 1 };
						let deleted: Nullable<string> = null;
						policy.setDeleter((evictedEntry) => {
							deleted = evictedEntry.key;

							const evictableKeyNode = evictedEntry as EvictableCacheEntry<string, number>;
							policy.onDelete(evictableKeyNode);
							expect(evictableKeyNode[NEXT_SYM]).to.be.eq(null);
							expect(evictableKeyNode[PREV_SYM]).to.be.eq(null);
							expect(evictableKeyNode[BUCKET_HEADER_SYM]).toBeUndefined();
						});

						totalEntriesNo += 1; // simulate overflow
						policy.onSet(entry);

						expect(deleted).to.not.be.eq(null); // our deleter has been called...
						expect(deleted).to.not.be.eq(entry.key); // ...on some random entry (all of them have 0 frequency)...
						expect(policy.size).to.be.eq(CAPACITY); // ...and number of req nodes remained the same
					} catch (error) {
						const message = ['Test Context:', `${'CAPACITY'.magenta}\t\t: ${CAPACITY}`];
						logger.info(message.join('\n'));
						throw error;
					}
				});

				it('should evict least frequently used item', () => {
					expect.hasAssertions();

					const CAPACITY = randomInt(1, 21);
					const ADDITIONAL_ENTRIES_NO = randomInt(1, CAPACITY + 1);

					const ENTRIES = new Map<string, number>(range(0, CAPACITY).map((n) => [String(n), n]));
					const ADDITIONAL_ENTRIES = new Map<string, number>(range(CAPACITY, CAPACITY + ADDITIONAL_ENTRIES_NO).map((n) => [String(n), n]));

					const ENTRY_FREQUENCIES = new Map<string, number>([...ENTRIES.keys()].map((key) => [key, randomInt(0, CAPACITY)]));
					const ADDITIONAL_ENTRIES_FREQUENCIES = new Map<string, number>([...ADDITIONAL_ENTRIES.keys()].map((key) => [key, CAPACITY + 1]));

					const GET_ORDER = shuffle(
						ENTRY_FREQUENCIES.keys()
							.flatMap((k) => new Array(ENTRY_FREQUENCIES.get(k)).fill(k))
							.toArray()
					);
					const ENTRIES_SORTED_BY_FREQ = new ReverseMap(ENTRY_FREQUENCIES);

					const EVICTED_KEYS = new Array<string>();

					try {
						let totalEntriesNo = 0;

						const policy = lfuFactory<string, number>(LFU_IMPL, CAPACITY, {
							get size() {
								return totalEntriesNo;
							}
						});
						const lfuEntries = new Map<string, EvictableCacheEntry<string, number>>();
						policy.setDeleter((evictedEntry) => {
							EVICTED_KEYS.push(evictedEntry.key);

							const evictableKeyNode = evictedEntry as EvictableCacheEntry<string, number>;
							policy.onDelete(evictableKeyNode);
							expect(evictableKeyNode[NEXT_SYM]).to.be.eq(null);
							expect(evictableKeyNode[PREV_SYM]).to.be.eq(null);
							expect(evictableKeyNode[BUCKET_HEADER_SYM]).toBeUndefined();
						});

						for (const [key, value] of ENTRIES) {
							// @ts-expect-error This is for testing purposesrposes
							const entry: EvictableCacheEntry<string, number> = { key, value };
							policy.onSet(entry);

							// console.log(policy.toFormattedString(BUCKET_FORMATTERS));

							lfuEntries.set(key, entry);
							totalEntriesNo += 1;
						}
						expect(policy.size).to.be.eq(CAPACITY);
						expect(totalEntriesNo).to.be.eq(CAPACITY);

						// console.log('\n');

						for (const key of GET_ORDER) {
							const entry = lfuEntries.get(key);
							if (entry == null) {
								throw new Error(`Could not find entry for ${key.magenta}.`);
							}

							policy.onHit(entry);

							// console.log(policy.toFormattedString(BUCKET_FORMATTERS));
						}

						// console.log('\n');

						totalEntriesNo += 1; // simulate overflow

						for (const [key, value] of ADDITIONAL_ENTRIES) {
							// @ts-expect-error This is for testing purposesrposes
							const entry: EvictableCacheEntry<string, number> = { key, value };
							policy.onSet(entry); // we don't increment totalEntriesNo, as we know entries are evicted and it's value remains the same

							// console.log(policy.toFormattedString(BUCKET_FORMATTERS));
							// console.log(policy.size);

							const spinUpFrequency = ADDITIONAL_ENTRIES_FREQUENCIES.get(key) ?? 0;
							for (let i = 0; i < spinUpFrequency; i++) {
								policy.onHit(entry); // we need to bump up, otherwise further newly added items will be evicted, as they start with low counter
							}
						}

						if (policy instanceof GDSFEvictionPolicy) {
							// it evicts them based on their size and has different order
							for (const evictedKey of EVICTED_KEYS) {
								expect(ENTRIES.has(evictedKey)).to.be.eq(true);
							}
						} else {
							expect(EVICTED_KEYS).to.have.length(ADDITIONAL_ENTRIES.size);
							for (const evictedKey of EVICTED_KEYS) {
								expect(ENTRIES_SORTED_BY_FREQ.bucket).to.contain(evictedKey);
							}
						}
					} catch (error) {
						const message = [
							'Test Context:',
							`${'CAPACITY'.magenta}\t\t: ${CAPACITY}`,
							`${'ADDITIONAL_ENTRIES_NO'.magenta}\t: ${ADDITIONAL_ENTRIES_NO}`,
							'\n',
							`${'ENTRIES'.magenta}\t\t\t: ${JSON.stringify([...ENTRIES])}`,
							`${'ENTRY_FREQUENCIES'.magenta}\t: ${JSON.stringify([...ENTRY_FREQUENCIES])}`,
							'\n',
							`${'ADDITIONAL_ENTRIES'.magenta}\t: ${JSON.stringify([...ADDITIONAL_ENTRIES])}`,
							`${'ADDITIONAL_ENTRIES_FREQ'.magenta}\t: ${JSON.stringify([...ADDITIONAL_ENTRIES_FREQUENCIES])}`,
							'\n',
							`${'GET_ORDER'.magenta}\t\t: ${JSON.stringify(GET_ORDER)}`,
							`${'ENTRIES_SORTED_BY_FREQ'.magenta}\t: ${JSON.stringify([...ENTRIES_SORTED_BY_FREQ])}`,
							`${'EVICTED_KEYS'.magenta}\t\t: ${JSON.stringify(EVICTED_KEYS)}`
						];
						logger.info(message.join('\n'));
						throw error;
					}
				});

				it('should evict least recently used item when all items have same frequency', () => {
					expect.hasAssertions();

					const CAPACITY = randomInt(1, 17);
					const ADDITIONAL_ENTRIES_NO = randomInt(1, CAPACITY + 1);

					const ENTRIES = new Map(range(0, CAPACITY).map((num) => [String(num), num]));
					const ADDITIONAL_ENTRIES = new Map(range(CAPACITY, CAPACITY + ADDITIONAL_ENTRIES_NO).map((num) => [String(num), num]));
					const EVICTED_KEYS = new Array<string>();

					try {
						let totalEntriesNo = 0;

						const policy = lfuFactory<string, number>(LFU_IMPL, CAPACITY, {
							get size() {
								return totalEntriesNo;
							}
						});
						policy.setDeleter((evictedEntry) => {
							EVICTED_KEYS.push(evictedEntry.key);

							const evictableKeyNode = evictedEntry as EvictableCacheEntry<string, number>;
							policy.onDelete(evictableKeyNode);
							expect(evictableKeyNode[NEXT_SYM]).to.be.eq(null);
							expect(evictableKeyNode[PREV_SYM]).to.be.eq(null);
							expect(evictableKeyNode[BUCKET_HEADER_SYM]).toBeUndefined();
						});

						for (const [key, value] of ENTRIES) {
							// @ts-expect-error This is for testing purposesrposes
							const entry: EvictableCacheEntry<string, number> = { key, value };
							policy.onSet(entry);
							totalEntriesNo += 1;
						}
						expect(policy.size).to.be.eq(CAPACITY);
						expect(totalEntriesNo).to.be.eq(CAPACITY);

						totalEntriesNo += 1; // simulate overflow

						for (const [key, value] of ADDITIONAL_ENTRIES) {
							// @ts-expect-error This is for testing purposesrposes
							const entry: EvictableCacheEntry<string, number> = { key, value };
							policy.onSet(entry);
						}

						const entriesIter = ENTRIES.keys();

						expect(EVICTED_KEYS).to.have.length(ADDITIONAL_ENTRIES_NO);
						for (const key of EVICTED_KEYS) {
							expect(key).to.be.eq(entriesIter.next().value);
						}
					} catch (error) {
						const message = [
							'Test Context:',
							`${'CAPACITY'.magenta}\t\t: ${CAPACITY}`,
							`${'ADDITIONAL_ENTRIES_NO'.magenta}\t: ${ADDITIONAL_ENTRIES_NO}`,
							`${'ENTRIES'.magenta}\t\t\t: ${JSON.stringify([...ENTRIES])}`,
							`${'ADDITIONAL_ENTRIES'.magenta}\t: ${JSON.stringify([...ADDITIONAL_ENTRIES])}`,
							`${'EVICTED_KEYS'.magenta}\t\t: ${JSON.stringify(EVICTED_KEYS)}`
						];
						logger.info(message.join('\n'));
						throw error;
					}
				});
			});

			describe(`${LFU_IMPL.prototype.onDelete.name.magenta} & ${LFU_IMPL.prototype.onClear.name.magenta} spec`, () => {
				it('removes entry from internal frequency list when it gets deleted from cache', () => {
					expect.hasAssertions();

					const CAPACITY = randomInt(1, 15);
					const KEYS_TO_DELETE_NO = randomInt(1, CAPACITY + 1);

					const ENTRIES = new Map<string, number>(range(0, CAPACITY).map((n) => [String(n), n]));
					const ENTRY_FREQUENCIES = new Map<string, number>([...ENTRIES.keys()].map((key) => [key, randomInt(0, CAPACITY)]));

					const GET_ORDER = shuffle(
						ENTRY_FREQUENCIES.keys()
							.flatMap((k) => new Array(ENTRY_FREQUENCIES.get(k)).fill(k))
							.toArray()
					);
					const KEYS_TO_DELETE = shuffle(Array.from({ length: KEYS_TO_DELETE_NO }, (_, i) => String(i)));

					const EVICTED_KEYS = new Array<string>();

					try {
						let totalEntriesNo = 0;

						// setup policy
						const policy = lfuFactory<string, number>(LFU_IMPL, CAPACITY, {
							get size() {
								return totalEntriesNo;
							}
						});
						const lfuEntries = new Map<string, EvictableCacheEntry<string, number>>();
						policy.setDeleter((evictedEntry) => {
							EVICTED_KEYS.push(evictedEntry.key);

							const evictableKeyNode = evictedEntry as EvictableCacheEntry<string, number>;
							policy.onDelete(evictableKeyNode);
							expect(evictableKeyNode[NEXT_SYM]).to.be.eq(null);
							expect(evictableKeyNode[PREV_SYM]).to.be.eq(null);
							expect(evictableKeyNode[BUCKET_HEADER_SYM]).toBeUndefined();
						});

						// add entries
						for (const [key, value] of ENTRIES) {
							// @ts-expect-error This is for testing purposesrposes
							const entry: EvictableCacheEntry<string, number> = { key, value };
							policy.onSet(entry);
							lfuEntries.set(key, entry);
							totalEntriesNo += 1;
						}
						expect(policy.size).to.be.eq(CAPACITY);
						expect(totalEntriesNo).to.be.eq(CAPACITY);

						// simulate gets, to increase entries frequency
						for (const key of GET_ORDER) {
							const entry = lfuEntries.get(key);
							if (entry == null) {
								throw new Error(`Could not find entry for ${key.magenta}.`);
							}

							policy.onHit(entry);
						}

						// remove some random keys
						for (const key of KEYS_TO_DELETE) {
							const entry = lfuEntries.get(key);
							if (entry == null) {
								throw new Error(`No entry found for ${key.magenta}.`);
							}

							policy.onDelete(entry);
						}

						// assertions
						expect(policy.size).to.be.eq(CAPACITY - KEYS_TO_DELETE_NO);
						expect(EVICTED_KEYS).to.have.length(0);
					} catch (error) {
						const message = [
							'Test Context:',
							`${'CAPACITY'.magenta}\t\t: ${CAPACITY}`,
							`${'KEYS_TO_DELETE_NO'.magenta}\t: ${KEYS_TO_DELETE_NO}`,
							'\n',
							`${'ENTRIES'.magenta}\t\t\t: ${JSON.stringify([...ENTRIES])}`,
							`${'ENTRY_FREQUENCIES'.magenta}\t: ${JSON.stringify([...ENTRY_FREQUENCIES])}`,
							'\n',
							`${'GET_ORDER'.magenta}\t\t: ${JSON.stringify(GET_ORDER)}`,
							`${'KEYS_TO_DELETE'.magenta}\t\t: ${JSON.stringify(KEYS_TO_DELETE)}`,
							`${'EVICTED_KEYS'.magenta}\t\t: ${JSON.stringify(EVICTED_KEYS)}`
						];
						logger.info(message.join('\n'));
						throw error;
					}
				});

				// oxlint-disable-next-line no-disabled-tests
				it.skip('clears the freq list', () => {
					const CAPACITY = 100_000;
					const HEAP_USED_DELTA = 150_000;

					let totalEntriesNo = 0;

					const lfu = lfuFactory<string, number>(LFU_IMPL, CAPACITY, {
						get size() {
							return totalEntriesNo;
						}
					});
					const lfuEntries = new Map<string, EvictableCacheEntry<string, number>>(); // simulates cache

					gc();
					const memUsageBeforeInsert = { ...process.memoryUsage() };

					for (let i = 0; i < CAPACITY; i++) {
						// @ts-expect-error This is for testing purposesrposes
						const entry: EvictableCacheEntry<string, number> = { key: String(i), value: i };
						lfu.onSet(entry);
						lfuEntries.set(entry.key, entry);
						totalEntriesNo += 1;
					}
					expect(lfu.size).to.be.eq(CAPACITY);

					lfu.onClear();
					lfuEntries.clear();

					gc();
					const memUsageAfterClear = { ...process.memoryUsage() };

					expect(memUsageAfterClear.heapUsed).to.be.within(
						memUsageBeforeInsert.heapUsed - HEAP_USED_DELTA,
						memUsageBeforeInsert.heapUsed + HEAP_USED_DELTA
					);
					expect(memUsageAfterClear.external).to.be.at.most(memUsageBeforeInsert.external);
					expect(memUsageAfterClear.arrayBuffers).to.be.at.most(memUsageBeforeInsert.arrayBuffers);
				});
			});
		});
	});
});

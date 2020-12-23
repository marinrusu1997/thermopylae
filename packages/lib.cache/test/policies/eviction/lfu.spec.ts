import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import { UnitTestLogger } from '@thermopylae/lib.unit-test/dist/logger';
import { array, number } from '@thermopylae/lib.utils';
import { Nullable } from '@thermopylae/core.declarations';
import colors from 'colors';
import range from 'lodash.range';
// @ts-ignore
import gc from 'js-gc';
import { LFUEvictionPolicy } from '../../../lib/policies/eviction/lfu';
import { SetOperationContext } from '../../../lib/contracts/cache-policy';
import { ReverseMap } from '../../utils';
import { BaseLFUEvictionPolicy, EvictableKeyNode } from '../../../lib/policies/eviction/lfu-base';
import { GDSFEvictionPolicy } from '../../../lib/policies/eviction/gdsf';
import { LFUDAEvictionPolicy } from '../../../lib/policies/eviction/lfuda';

// const BUCKET_FORMATTERS = [colors.magenta, colors.green, colors.blue, colors.red];
const LFU_IMPLS = [LFUEvictionPolicy, LFUDAEvictionPolicy, GDSFEvictionPolicy];

function lfuFactory<Key, Value>(
	constructor: typeof BaseLFUEvictionPolicy,
	...capacity: ConstructorParameters<typeof LFUEvictionPolicy>
): BaseLFUEvictionPolicy<Key, Value> {
	// @ts-ignore
	return new constructor(capacity);
}

describe(`${colors.magenta(BaseLFUEvictionPolicy.name)} spec`, () => {
	for (const LFU_IMPL of LFU_IMPLS) {
		describe(`${LFU_IMPL.name.magenta} spec`, () => {
			describe(`${LFU_IMPL.prototype.onHit.name.magenta} & ${LFU_IMPL.prototype.onSet.name.magenta} spec`, () => {
				it('should not evict entries until capacity cap is met', () => {
					const CAPACITY = number.randomInt(1, 11);
					try {
						const lfu = lfuFactory<string, number>(LFU_IMPL, CAPACITY);
						const candidates = new Map<string, number>();
						for (let i = 0; i < CAPACITY; i++) {
							candidates.set(String(i), i);
						}

						const context: SetOperationContext = { totalEntriesNo: 0 };

						for (const [key, value] of candidates) {
							// @ts-ignore
							const entry: EvictableKeyNode<string, number> = { key, value };
							lfu.onSet(key, entry, context);
							context.totalEntriesNo += 1;

							expect(lfu.size).to.be.eq(context.totalEntriesNo); // stacks up entries
						}

						// @ts-ignore
						const entry: EvictableKeyNode<string, number> = { key: String(CAPACITY + 1), value: CAPACITY + 1 };
						let deleted: Nullable<string> = null;
						lfu.setDeleter((key) => {
							deleted = key;
						});

						lfu.onSet(entry.key, entry, context);

						expect(deleted).to.not.be.eq(null); // our deleter has been called...
						expect(deleted).to.not.be.eq(entry.key); // ...on some random entry (all of them have 0 frequency)...
						expect(lfu.size).to.be.eq(context.totalEntriesNo); // ...and number of req nodes remained the same
					} catch (e) {
						const message = ['Test Context:', `${'CAPACITY'.magenta}\t\t: ${CAPACITY}`];
						UnitTestLogger.info(message.join('\n'));
						throw e;
					}
				});

				it('should evict least frequently used item', () => {
					const CAPACITY = number.randomInt(1, 21);
					const ADDITIONAL_ENTRIES_NO = number.randomInt(1, CAPACITY);

					const ENTRIES = new Map<string, number>(range(0, CAPACITY).map((n) => [String(n), n]));
					const ADDITIONAL_ENTRIES = new Map<string, number>(range(CAPACITY, CAPACITY + ADDITIONAL_ENTRIES_NO).map((n) => [String(n), n]));

					const ENTRY_FREQUENCIES = new Map<string, number>(Array.from(ENTRIES.keys()).map((key) => [key, number.randomInt(0, CAPACITY)]));
					const ADDITIONAL_ENTRIES_FREQUENCIES = new Map<string, number>(Array.from(ADDITIONAL_ENTRIES.keys()).map((key) => [key, CAPACITY + 1]));

					const GET_ORDER = array.shuffle([...ENTRY_FREQUENCIES.keys()].map((k) => array.filledWith(ENTRY_FREQUENCIES.get(k)!, k)).flat());
					const ENTRIES_SORTED_BY_FREQ = new ReverseMap(ENTRY_FREQUENCIES);

					const EVICTED_KEYS = new Array<string>();

					try {
						const lfu = lfuFactory<string, number>(LFU_IMPL, CAPACITY);
						const lfuEntries = new Map<string, EvictableKeyNode<string, number>>();
						lfu.setDeleter((key) => EVICTED_KEYS.push(key));

						const context: SetOperationContext = { totalEntriesNo: 0 };
						for (const [key, value] of ENTRIES) {
							// @ts-ignore
							const entry: EvictableKeyNode<string, number> = { key, value };
							lfu.onSet(key, entry, context);

							// console.log(lfu.toFormattedString(BUCKET_FORMATTERS));

							lfuEntries.set(key, entry);
							context.totalEntriesNo += 1;
						}
						expect(lfu.size).to.be.eq(CAPACITY);
						expect(context.totalEntriesNo).to.be.eq(CAPACITY);

						// console.log('\n');

						for (const key of GET_ORDER) {
							const entry = lfuEntries.get(key);
							if (entry == null) {
								throw new Error(`Could not find entry for ${key.magenta}.`);
							}

							lfu.onHit(key, entry);

							// console.log(lfu.toFormattedString(BUCKET_FORMATTERS));
						}

						// console.log('\n');

						for (const [key, value] of ADDITIONAL_ENTRIES) {
							// @ts-ignore
							const entry: EvictableKeyNode<string, number> = { key, value };
							lfu.onSet(key, entry, context); // we don't increment context, as we know entries are evicted and it's value remains the same

							// console.log(lfu.toFormattedString(BUCKET_FORMATTERS));
							// console.log(lfu.size);

							const spinUpFrequency = ADDITIONAL_ENTRIES_FREQUENCIES.get(key)!;
							for (let i = 0; i < spinUpFrequency; i++) {
								lfu.onHit(key, entry); // we need to bump up, otherwise further newly added items will be evicted, as they start with low counter
							}
						}

						if (lfu instanceof GDSFEvictionPolicy) {
							// it evicts them based on their size and has different order
							for (const evictedKey of EVICTED_KEYS) {
								expect(ENTRIES.has(evictedKey)).to.be.eq(true);
							}
						} else {
							expect(EVICTED_KEYS).to.be.ofSize(ADDITIONAL_ENTRIES.size);
							for (let i = 0; i < EVICTED_KEYS.length; i++) {
								expect(ENTRIES_SORTED_BY_FREQ.bucket).to.be.containing(EVICTED_KEYS[i]);
							}
						}
					} catch (e) {
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
						UnitTestLogger.info(message.join('\n'));
						throw e;
					}
				});

				it('should evict least recently used item when all items have same frequency', () => {
					const CAPACITY = number.randomInt(1, 17);
					const ADDITIONAL_ENTRIES_NO = number.randomInt(1, CAPACITY);

					const ENTRIES = new Map(range(0, CAPACITY).map((num) => [String(num), num]));
					const ADDITIONAL_ENTRIES = new Map(range(CAPACITY, CAPACITY + ADDITIONAL_ENTRIES_NO).map((num) => [String(num), num]));
					const EVICTED_KEYS = new Array<string>();

					try {
						const lfu = lfuFactory<string, number>(LFU_IMPL, CAPACITY);
						lfu.setDeleter((key) => EVICTED_KEYS.push(key));

						const context: SetOperationContext = { totalEntriesNo: 0 };
						for (const [key, value] of ENTRIES) {
							// @ts-ignore
							const entry: EvictableKeyNode<string, number> = { key, value };
							lfu.onSet(key, entry, context);
							context.totalEntriesNo += 1;
						}
						expect(lfu.size).to.be.eq(CAPACITY);
						expect(context.totalEntriesNo).to.be.eq(CAPACITY);

						for (const [key, value] of ADDITIONAL_ENTRIES) {
							// @ts-ignore
							const entry: EvictableKeyNode<string, number> = { key, value };
							lfu.onSet(key, entry, context);
						}

						const entriesIter = ENTRIES.keys();

						expect(EVICTED_KEYS).to.be.ofSize(ADDITIONAL_ENTRIES_NO);
						for (const key of EVICTED_KEYS) {
							expect(key).to.be.eq(entriesIter.next().value);
						}
					} catch (e) {
						const message = [
							'Test Context:',
							`${'CAPACITY'.magenta}\t\t: ${CAPACITY}`,
							`${'ADDITIONAL_ENTRIES_NO'.magenta}\t: ${ADDITIONAL_ENTRIES_NO}`,
							`${'ENTRIES'.magenta}\t\t\t: ${JSON.stringify([...ENTRIES])}`,
							`${'ADDITIONAL_ENTRIES'.magenta}\t: ${JSON.stringify([...ADDITIONAL_ENTRIES])}`,
							`${'EVICTED_KEYS'.magenta}\t\t: ${JSON.stringify(EVICTED_KEYS)}`
						];
						UnitTestLogger.info(message.join('\n'));
						throw e;
					}
				});
			});

			describe(`${LFU_IMPL.prototype.onDelete.name.magenta} & ${LFU_IMPL.prototype.onClear.name.magenta} spec`, () => {
				it("removes entry from internal frequency list when it get's deleted from cache", () => {
					const CAPACITY = number.randomInt(1, 15);
					const KEYS_TO_DELETE_NO = number.randomInt(1, CAPACITY);

					const ENTRIES = new Map<string, number>(range(0, CAPACITY).map((n) => [String(n), n]));
					const ENTRY_FREQUENCIES = new Map<string, number>(Array.from(ENTRIES.keys()).map((key) => [key, number.randomInt(0, CAPACITY)]));

					const GET_ORDER = array.shuffle([...ENTRY_FREQUENCIES.keys()].map((k) => array.filledWith(ENTRY_FREQUENCIES.get(k)!, k)).flat());
					const KEYS_TO_DELETE = array.filledWith(KEYS_TO_DELETE_NO, () => String(number.randomInt(0, CAPACITY - 1)), { noDuplicates: true });

					const EVICTED_KEYS = new Array<string>();

					try {
						// setup policy
						const lfu = lfuFactory<string, number>(LFU_IMPL, CAPACITY);
						const lfuEntries = new Map<string, EvictableKeyNode<string, number>>();
						lfu.setDeleter((key) => EVICTED_KEYS.push(key));

						// add entries
						const context: SetOperationContext = { totalEntriesNo: 0 };
						for (const [key, value] of ENTRIES) {
							// @ts-ignore
							const entry: EvictableKeyNode<string, number> = { key, value };
							lfu.onSet(key, entry, context);
							lfuEntries.set(key, entry);
							context.totalEntriesNo += 1;
						}
						expect(lfu.size).to.be.eq(CAPACITY);
						expect(context.totalEntriesNo).to.be.eq(CAPACITY);

						// simulate gets, to increase entries frequency
						for (const key of GET_ORDER) {
							const entry = lfuEntries.get(key);
							if (entry == null) {
								throw new Error(`Could not find entry for ${key.magenta}.`);
							}

							lfu.onHit(key, entry);
						}

						// remove some random keys
						for (const key of KEYS_TO_DELETE) {
							const entry = lfuEntries.get(key);
							if (entry == null) {
								throw new Error(`No entry found for ${key.magenta}.`);
							}

							lfu.onDelete(key, entry);
						}

						// assertions
						expect(lfu.size).to.be.eq(CAPACITY - KEYS_TO_DELETE_NO);
						expect(EVICTED_KEYS).to.be.ofSize(0);
					} catch (e) {
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
						UnitTestLogger.info(message.join('\n'));
						throw e;
					}
				});

				it('clears the freq list', () => {
					const CAPACITY = 1_00_000;
					const HEAP_USED_DELTA = 150_000;

					const lfu = lfuFactory<string, number>(LFU_IMPL, CAPACITY);
					const lfuEntries = new Map<string, EvictableKeyNode<string, number>>(); // simulates cache

					gc();
					const memUsageBeforeInsert = { ...process.memoryUsage() };

					const context: SetOperationContext = { totalEntriesNo: 0 };
					for (let i = 0; i < CAPACITY; i++) {
						// @ts-ignore
						const entry: EvictableKeyNode<string, number> = { key: String(i), value: i };
						lfu.onSet(entry.key, entry, context);
						lfuEntries.set(entry.key, entry);
						context.totalEntriesNo += 1;
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
	}
});

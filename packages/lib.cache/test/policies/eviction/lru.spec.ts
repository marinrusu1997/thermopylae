import { logger } from '@thermopylae/dev.unit-test';
import { array, number } from '@thermopylae/lib.utils';
import colors from 'colors';
import range from 'lodash.range';
import { randomInt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DoublyLinkedList, NEXT_SYM, PREV_SYM } from '../../../lib/data-structures/list/doubly-linked.js';
import { type EvictableCacheEntry, LRUEvictionPolicy } from '../../../lib/policies/eviction/lru.js';

describe(`${colors.magenta(LRUEvictionPolicy.name)} spec`, () => {
	it('updates least recently used items on each get operation', () => {
		expect.hasAssertions();

		const CAPACITY = randomInt(1, 20);

		try {
			let totalEntriesNo = 0;

			const usageRecency = new DoublyLinkedList<EvictableCacheEntry<string, number>>();
			const policy = new LRUEvictionPolicy<string, number, unknown>(
				CAPACITY,
				{
					get size() {
						return totalEntriesNo;
					}
				},
				usageRecency
			);

			// intercept keys that policy wants to delete
			const keysEvictedByPolicy = new Array<string>();
			policy.setDeleter((evictedEntry) => {
				keysEvictedByPolicy.push(evictedEntry.key);

				const evictableKeyNode = evictedEntry as EvictableCacheEntry<string, number>;
				policy.onDelete(evictableKeyNode);
				expect(evictableKeyNode[NEXT_SYM]).to.be.eq(null);
				expect(evictableKeyNode[PREV_SYM]).to.be.eq(null);
			});

			// add some entries up to `CAPACITY`
			const initialEntries: readonly EvictableCacheEntry<string, number>[] = Object.freeze(
				Array.from({ length: CAPACITY }, (_, i) => ({
					key: String(i),
					value: i,
					[PREV_SYM]: null,
					[NEXT_SYM]: null
				}))
			);
			for (let i = 0; i < initialEntries.length; i++) {
				totalEntriesNo = i;
				policy.onSet(initialEntries[i]);
			}

			const policyStorageMirror = [...initialEntries].reverse();
			expect([...usageRecency].map((e) => e.key)).toStrictEqual(policyStorageMirror.map((e) => e.key));

			// simulate some get requests, so that policy order by usage timeline
			const retrievedEntries = Object.freeze(
				Array.from(
					{ length: randomInt(Math.round(number.percentage(initialEntries.length, 0.2)), Math.round(number.percentage(initialEntries.length, 0.8))) },
					array.randomUniqueItem(initialEntries)
				)
			);
			expect(retrievedEntries.map((e) => e.key)).to.have.length(new Set(retrievedEntries.map((e) => e.key)).size);

			for (const entry of retrievedEntries) {
				policy.onHit(entry);

				policyStorageMirror.splice(
					policyStorageMirror.findIndex((e) => e.key === entry.key),
					1
				);
				policyStorageMirror.unshift(entry);

				expect([...usageRecency].map((e) => e.key)).toStrictEqual(policyStorageMirror.map((e) => e.key));
			}

			// now let's add new entries to make policy evict least recently used entries
			let additionalEntriesIndex = 0;

			const numberOfInsertsThatWillCauseEviction = initialEntries.length - retrievedEntries.length; // evict entries that were never queried
			totalEntriesNo = initialEntries.length + 1; // simulate overflow
			for (let i = 0; i < numberOfInsertsThatWillCauseEviction; i++) {
				const entry = {
					key: String(initialEntries.length + additionalEntriesIndex),
					value: initialEntries.length + additionalEntriesIndex,
					[PREV_SYM]: null,
					[NEXT_SYM]: null
				} satisfies EvictableCacheEntry<string, number>;

				policy.onSet(entry); // we are full from now on, since we added initial `CAPACITY` entries
				policyStorageMirror.pop();
				policyStorageMirror.unshift(entry);
				additionalEntriesIndex += 1;

				expect([...usageRecency].map((e) => e.key)).toStrictEqual(policyStorageMirror.map((e) => e.key));
			}

			// check that it evicted least recently used entries, namely the ones that were never retrieved
			expect(keysEvictedByPolicy).to.have.length(numberOfInsertsThatWillCauseEviction);
			for (const evictedKey of keysEvictedByPolicy) {
				expect(retrievedEntries.find((entry) => entry.key === evictedKey)).toBeUndefined();
			}

			// now check that it will evict the entries that we retrieved before, and in the order they were retrieved
			keysEvictedByPolicy.length = 0;
			totalEntriesNo = initialEntries.length + 1; // simulate overflow
			for (const _ of retrievedEntries) {
				const entry = {
					key: String(initialEntries.length + additionalEntriesIndex),
					value: initialEntries.length + additionalEntriesIndex,
					[PREV_SYM]: null,
					[NEXT_SYM]: null
				} satisfies EvictableCacheEntry<string, number>;

				policy.onSet(entry); // we are still full
				policyStorageMirror.pop();
				policyStorageMirror.unshift(entry);
				additionalEntriesIndex += 1;

				expect([...usageRecency].map((e) => e.key)).toStrictEqual(policyStorageMirror.map((e) => e.key));
			}

			expect(retrievedEntries.map((e) => e.key)).toStrictEqual(keysEvictedByPolicy); // they were removed in the same order they were retrieved
		} catch (error) {
			const message = ['Test Context:', `${'CAPACITY'.magenta}\t\t: ${CAPACITY}`];
			logger.info(message.join('\n'));
			throw error;
		}
	});

	it("removes key from internal tracking structure when it's deleted from cache", () => {
		expect.hasAssertions();

		const CAPACITY = randomInt(1, 17);

		try {
			let totalEntriesNo = 0;

			const policy = new LRUEvictionPolicy<string, number, unknown>(CAPACITY, {
				get size() {
					return totalEntriesNo;
				}
			});
			const entries = new Map<string, EvictableCacheEntry<string, number>>();

			// intercept keys that policy wants to delete
			const keysEvictedByPolicy = new Array<string>();
			policy.setDeleter((evictedEntry) => {
				keysEvictedByPolicy.push(evictedEntry.key);

				const evictableKeyNode = evictedEntry as EvictableCacheEntry<string, number>;
				policy.onDelete(evictableKeyNode);
				expect(evictableKeyNode[NEXT_SYM]).to.be.eq(null);
				expect(evictableKeyNode[PREV_SYM]).to.be.eq(null);
			});

			// setup keys up to `CAPACITY`
			for (let i = 0; i < CAPACITY; i++) {
				totalEntriesNo = i;

				const key = String(i);
				// @ts-expect-error This is for testing purposesrposes
				const entry: EvictableCacheEntry<string, number> = { key, value: i };
				policy.onSet(entry);
				entries.set(key, entry);
			}

			// remove keys up to `CAPACITY` in random order
			const keysToRemove = range(0, CAPACITY);
			while (keysToRemove.length > 0) {
				const key = String(keysToRemove.pop());
				const entry = entries.get(key);
				if (!entry) {
					throw new Error(`No entry for key '${key}'`);
				}
				policy.onDelete(entry);
			}
			expect(keysEvictedByPolicy).to.have.length(0); // it just removed from internal structure, and not from cache

			// setup back some keys, a double amount to check that it removed the new one, instead of the ones we manually removed
			for (let i = 0; i <= CAPACITY * 2; i++) {
				totalEntriesNo = i;

				// @ts-expect-error This is for testing purposesrposes
				const entry: EvictableCacheEntry<string, number> = { key: String(i + CAPACITY), value: i + CAPACITY }; // differ from initial inserted keys
				policy.onSet(entry);
			}

			// assert it evicted keys inserted above, and not the initial ones
			expect(keysEvictedByPolicy).to.have.length(CAPACITY);
			expect(keysEvictedByPolicy).to.containSubset(range(CAPACITY, CAPACITY * 2).map(String));
		} catch (error) {
			const message = ['Test Context:', `${'CAPACITY'.magenta}\t\t: ${CAPACITY}`];
			logger.info(message.join('\n'));
			throw error;
		}
	});
});

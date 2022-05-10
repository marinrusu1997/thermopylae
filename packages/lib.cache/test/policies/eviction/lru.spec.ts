// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it } from 'mocha';
import { expect, logger } from '@thermopylae/dev.unit-test';
import { array, number } from '@thermopylae/lib.utils';
import range from 'lodash.range';
import colors from 'colors';
import { EvictableCacheEntry, LRUEvictionPolicy } from '../../../lib/policies/eviction/lru';
import { NEXT_SYM, PREV_SYM } from '../../../lib/data-structures/list/doubly-linked';

describe(`${colors.magenta(LRUEvictionPolicy.name)} spec`, () => {
	it('updates least recently used items on each get operation', () => {
		const CAPACITY = number.randomInt(1, 21);

		try {
			let totalEntriesNo = 0;

			const policy = new LRUEvictionPolicy<string, number, any>(CAPACITY, {
				get size() {
					return totalEntriesNo;
				}
			});

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
			const initialEntries = new Array<EvictableCacheEntry<string, number>>(CAPACITY);
			for (let i = 0; i < CAPACITY; i++) {
				totalEntriesNo = i;

				// @ts-ignore This is for testing purposes
				const entry: EvictableCacheEntry<string, number> = { key: String(i), value: i };
				policy.onSet(entry); // `i` reflects the actual total entries, e.g. when we add first time it is 0
				initialEntries[i] = entry;
			}

			// simulate some get requests, so that policy order by usage timeline
			const retrievedEntriesIndexes = array.filledWith(
				number.randomInt(number.percentage(CAPACITY, 0.2), number.percentage(CAPACITY, 0.6)),
				() => number.randomInt(0, CAPACITY - 1),
				{ noDuplicates: true }
			);
			for (const retrieveIndex of retrievedEntriesIndexes) {
				policy.onHit(initialEntries[retrieveIndex]);
			}

			// now let's add new entries to make policy evict least recently used entries
			let additionalEntriesIndex = 0;

			const numberOfSetsThatWillCauseEviction = CAPACITY - retrievedEntriesIndexes.length; // evict entries that were never queried
			totalEntriesNo = CAPACITY + 1; // simulate overflow
			for (let i = 0; i < numberOfSetsThatWillCauseEviction; i++) {
				// @ts-ignore This is for testing purposes
				const entry: EvictableCacheEntry<string, number> = {
					key: String(CAPACITY + additionalEntriesIndex),
					value: CAPACITY + additionalEntriesIndex
				};
				policy.onSet(entry); // we are full from now on, since we added initial `CAPACITY` entries
				additionalEntriesIndex += 1;
			}

			// check that it evicted least recently used entries, namely the ones that were never retrieved
			expect(keysEvictedByPolicy).to.be.ofSize(numberOfSetsThatWillCauseEviction);
			for (const evictedKey of keysEvictedByPolicy) {
				const evictedKeyIndexInInitialEntries = initialEntries.findIndex((entry) => entry.key === evictedKey);
				expect(retrievedEntriesIndexes).to.not.containing(evictedKeyIndexInInitialEntries);
			}

			// now check that it will evict the entries that we retrieved before, and in the order they were retrieved
			keysEvictedByPolicy.length = 0;
			totalEntriesNo = CAPACITY + 1; // simulate overflow
			for (let i = 0; i < retrievedEntriesIndexes.length; i++) {
				// @ts-ignore This is for testing purposes
				const entry: EvictableCacheEntry<string, number> = {
					key: String(CAPACITY + additionalEntriesIndex),
					value: CAPACITY + additionalEntriesIndex
				};
				policy.onSet(entry); // we are still full
				additionalEntriesIndex += 1;
			}

			expect(keysEvictedByPolicy).to.be.ofSize(retrievedEntriesIndexes.length);
			const evictedKeysThatWereRetrievedIndexes = keysEvictedByPolicy.map((key) => initialEntries.findIndex((entry) => entry.key === key));
			expect(retrievedEntriesIndexes).to.be.equalTo(evictedKeysThatWereRetrievedIndexes); // they were removed in the same order they were retrieved
		} catch (e) {
			const message = ['Test Context:', `${'CAPACITY'.magenta}\t\t: ${CAPACITY}`];
			logger.info(message.join('\n'));
			throw e;
		}
	});

	it("removes key from internal tracking structure when it's deleted from cache", () => {
		const CAPACITY = number.randomInt(1, 17);

		try {
			let totalEntriesNo = 0;

			const policy = new LRUEvictionPolicy<string, number, any>(CAPACITY, {
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
				// @ts-ignore This is for testing purposes
				const entry: EvictableCacheEntry<string, number> = { key, value: i };
				policy.onSet(entry);
				entries.set(key, entry);
			}

			// remove keys up to `CAPACITY` in random order
			const keysToRemove = range(0, CAPACITY);
			while (keysToRemove.length) {
				const key = String(keysToRemove.pop());
				policy.onDelete(entries.get(key)!);
			}
			expect(keysEvictedByPolicy).to.be.ofSize(0); // it just removed from internal structure, and not from cache

			// setup back some keys, a double amount to check that it removed the new one, instead of the ones we manually removed
			for (let i = 0; i <= CAPACITY * 2; i++) {
				totalEntriesNo = i;

				// @ts-ignore This is for testing purposes
				const entry: EvictableCacheEntry<string, number> = { key: String(i + CAPACITY), value: i + CAPACITY }; // differ from initial inserted keys
				policy.onSet(entry);
			}

			// assert it evicted keys inserted above, and not the initial ones
			expect(keysEvictedByPolicy).to.be.ofSize(CAPACITY);
			expect(keysEvictedByPolicy).to.be.containingAllOf(range(CAPACITY, CAPACITY * 2).map(String));
		} catch (e) {
			const message = ['Test Context:', `${'CAPACITY'.magenta}\t\t: ${CAPACITY}`];
			logger.info(message.join('\n'));
			throw e;
		}
	});
});

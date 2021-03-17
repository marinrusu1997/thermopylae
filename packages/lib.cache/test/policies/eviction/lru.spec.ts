import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import { UnitTestLogger } from '@thermopylae/lib.unit-test/dist/logger';
import { array, number } from '@thermopylae/lib.utils';
import range from 'lodash.range';
import colors from 'colors';
import { EvictableKeyNode, LRUEvictionPolicy } from '../../../lib/policies/eviction/lru';
import { NEXT_SYM, PREV_SYM } from '../../../lib/helpers/doubly-linked-list';

describe(`${colors.magenta(LRUEvictionPolicy.name)} spec`, () => {
	it('updates least recently used items on each get operation', () => {
		const CAPACITY = number.randomInt(1, 21);

		try {
			let totalEntriesNo = 0;
			const cacheSizeGetter = () => totalEntriesNo;

			const policy = new LRUEvictionPolicy<string, number, any>(CAPACITY, cacheSizeGetter);

			// intercept keys that policy wants to delete
			const keysEvictedByPolicy = new Array<string>();
			policy.setDeleter((evictedKey, evictedEntry) => {
				keysEvictedByPolicy.push(evictedKey);

				const evictableKeyNode = evictedEntry as EvictableKeyNode<string, number>;
				policy.onDelete(evictedKey, evictableKeyNode);
				expect(evictableKeyNode[NEXT_SYM]).to.be.eq(null);
				expect(evictableKeyNode[PREV_SYM]).to.be.eq(null);
			});

			// add some entries up to `CAPACITY`
			const initialEntries = new Array<EvictableKeyNode<string, number>>(CAPACITY);
			for (let i = 0; i < CAPACITY; i++) {
				totalEntriesNo = i;

				// @ts-ignore
				const entry: EvictableKeyNode<string, number> = { value: i };
				policy.onSet(String(i), entry); // `i` reflects the actual total entries, e.g. when we add first time it is 0
				initialEntries[i] = entry;
			}

			// simulate some get requests, so that policy order by usage timeline
			const retrievedEntriesIndexes = array.filledWith(
				number.randomInt(number.percentage(CAPACITY, 0.2), number.percentage(CAPACITY, 0.6)),
				() => number.randomInt(0, CAPACITY - 1),
				{ noDuplicates: true }
			);
			for (const retrieveIndex of retrievedEntriesIndexes) {
				policy.onHit('ignored-key-name', initialEntries[retrieveIndex]);
			}

			// now let's add new entries to make policy evict least recently used entries
			let additionalEntriesIndex = 0;

			const numberOfSetsThatWillCauseEviction = CAPACITY - retrievedEntriesIndexes.length; // evict entries that were never queried
			totalEntriesNo = CAPACITY;
			for (let i = 0; i < numberOfSetsThatWillCauseEviction; i++) {
				// @ts-ignore
				const entry: EvictableKeyNode<string, number> = { value: CAPACITY + additionalEntriesIndex };
				policy.onSet(String(entry.value), entry); // we are full from now on, since we added initial `CAPACITY` entries
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
			totalEntriesNo = CAPACITY;
			for (let i = 0; i < retrievedEntriesIndexes.length; i++) {
				// @ts-ignore
				const entry: EvictableKeyNode<string, number> = { value: CAPACITY + additionalEntriesIndex };
				policy.onSet(String(entry.value), entry); // we are still full
				additionalEntriesIndex += 1;
			}

			expect(keysEvictedByPolicy).to.be.ofSize(retrievedEntriesIndexes.length);
			const evictedKeysThatWereRetrievedIndexes = keysEvictedByPolicy.map((key) => initialEntries.findIndex((entry) => entry.key === key));
			expect(retrievedEntriesIndexes).to.be.equalTo(evictedKeysThatWereRetrievedIndexes); // they were removed in the same order they were retrieved
		} catch (e) {
			const message = ['Test Context:', `${'CAPACITY'.magenta}\t\t: ${CAPACITY}`];
			UnitTestLogger.info(message.join('\n'));
			throw e;
		}
	});

	it("removes key from internal tracking structure when it's deleted from cache", () => {
		const CAPACITY = number.randomInt(1, 17);

		try {
			let totalEntriesNo = 0;
			const cacheSizeGetter = () => totalEntriesNo;

			const policy = new LRUEvictionPolicy<string, number, any>(CAPACITY, cacheSizeGetter);
			const entries = new Map<string, EvictableKeyNode<string, number>>();

			// intercept keys that policy wants to delete
			const keysEvictedByPolicy = new Array<string>();
			policy.setDeleter((evictedKey, evictedEntry) => {
				keysEvictedByPolicy.push(evictedKey);

				const evictableKeyNode = evictedEntry as EvictableKeyNode<string, number>;
				policy.onDelete(evictedKey, evictableKeyNode);
				expect(evictableKeyNode[NEXT_SYM]).to.be.eq(null);
				expect(evictableKeyNode[PREV_SYM]).to.be.eq(null);
			});

			// setup keys up to `CAPACITY`
			for (let i = 0; i < CAPACITY; i++) {
				totalEntriesNo = i;

				const key = String(i);
				// @ts-ignore
				const entry: EvictableKeyNode<string, number> = { key, value: i };
				policy.onSet(key, entry);
				entries.set(key, entry);
			}

			// remove keys up to `CAPACITY` in random order
			const keysToRemove = range(0, CAPACITY);
			while (keysToRemove.length) {
				const key = String(keysToRemove.pop());
				policy.onDelete(key, entries.get(key)!);
			}
			expect(keysEvictedByPolicy).to.be.ofSize(0); // it just removed from internal structure, and not from cache

			// setup back some keys, a double amount to check that it removed the new one, instead of the ones we manually removed
			for (let i = 0; i < CAPACITY * 2; i++) {
				totalEntriesNo = i;

				// @ts-ignore
				const entry: EvictableKeyNode<string, number> = { value: i + CAPACITY }; // differ from initial inserted keys
				policy.onSet(String(entry.value), entry);
			}

			// assert it evicted keys inserted above, and not the initial ones
			expect(keysEvictedByPolicy).to.be.ofSize(CAPACITY);
			expect(keysEvictedByPolicy).to.be.containingAllOf(range(CAPACITY, CAPACITY * 2).map(String));
		} catch (e) {
			const message = ['Test Context:', `${'CAPACITY'.magenta}\t\t: ${CAPACITY}`];
			UnitTestLogger.info(message.join('\n'));
			throw e;
		}
	});
});

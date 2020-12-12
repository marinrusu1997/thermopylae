import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import { UnitTestLogger } from '@thermopylae/lib.unit-test/dist/logger';
import { array, number } from '@thermopylae/lib.utils';
import range from 'lodash.range';
import { EvictableKeyNode, LRUEvictionPolicy } from '../../../lib/policies/eviction/lru-eviction-policy';

describe(`${LRUEvictionPolicy.name} spec`, () => {
	it('updates least recently used items on each get operation', () => {
		const capacity = number.randomInt(1, 10);
		UnitTestLogger.info(`Working with capacity: ${capacity}`);

		const policy = new LRUEvictionPolicy<string, number>(capacity);

		// intercept keys that policy wants to delete
		const keysEvictedByPolicy = new Array<string>();
		policy.setDeleter((key) => keysEvictedByPolicy.push(key));

		// add some entries up to `capacity`
		const initialEntries = new Array<EvictableKeyNode<string, number>>(capacity);
		for (let i = 0; i < capacity; i++) {
			// @ts-ignore
			const entry: EvictableKeyNode<string, number> = { value: i };
			policy.onSet(String(i), entry, { totalEntriesNo: i }); // `i` reflects the actual total entries, e.g. when we add first time it is 0
			initialEntries[i] = entry;
		}

		// simulate some get requests, so that policy order by usage timeline
		const retrievedEntriesIndexes = array.filledWith(
			number.randomInt(number.percentage(capacity, 0.2), number.percentage(capacity, 0.6)),
			() => number.randomInt(0, capacity - 1),
			{ noDuplicates: true }
		);
		for (const retrieveIndex of retrievedEntriesIndexes) {
			policy.onGet('ignored-key-name', initialEntries[retrieveIndex]);
		}

		// now let's add new entries to make policy evict least recently used entries
		let additionalEntriesIndex = 0;

		const numberOfSetsThatWillCauseEviction = capacity - retrievedEntriesIndexes.length; // evict entries that were never queried
		for (let i = 0; i < numberOfSetsThatWillCauseEviction; i++) {
			// @ts-ignore
			const entry: EvictableKeyNode<string, number> = { value: capacity + additionalEntriesIndex };
			policy.onSet(String(entry.value), entry, { totalEntriesNo: capacity }); // we are full from now on, since we added initial `capacity` entries
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
		for (let i = 0; i < retrievedEntriesIndexes.length; i++) {
			// @ts-ignore
			const entry: EvictableKeyNode<string, number> = { value: capacity + additionalEntriesIndex };
			policy.onSet(String(entry.value), entry, { totalEntriesNo: capacity }); // we are still full
			additionalEntriesIndex += 1;
		}

		expect(keysEvictedByPolicy).to.be.ofSize(retrievedEntriesIndexes.length);
		const evictedKeysThatWereRetrievedIndexes = keysEvictedByPolicy.map((key) => initialEntries.findIndex((entry) => entry.key === key));
		expect(retrievedEntriesIndexes).to.be.equalTo(evictedKeysThatWereRetrievedIndexes); // they were removed in the same order they were retrieved
	});

	it("removes key from internal tracking structure when it's deleted from cache", () => {
		const capacity = number.randomInt(1, 10);
		UnitTestLogger.info(`Working with capacity: ${capacity}`);

		const policy = new LRUEvictionPolicy<string, number>(capacity);

		// intercept keys that policy wants to delete
		const keysEvictedByPolicy = new Array<string>();
		policy.setDeleter((key) => keysEvictedByPolicy.push(key));

		// setup keys up to `capacity`
		for (let i = 0; i < capacity; i++) {
			// @ts-ignore
			const entry: EvictableKeyNode<string, number> = { value: i };
			policy.onSet(String(i), entry, { totalEntriesNo: i });
		}

		// remove keys up to `capacity` in random order
		const keysToRemove = range(0, capacity);
		while (keysToRemove.length) {
			policy.onDelete(String(keysToRemove.pop()));
		}
		expect(keysEvictedByPolicy).to.be.ofSize(0); // it just removed from internal structure, and not from cache

		// setup back some keys, a double amount to check that it removed the new one, instead of the ones we manually removed
		for (let i = 0; i < capacity * 2; i++) {
			// @ts-ignore
			const entry: EvictableKeyNode<string, number> = { value: i + capacity }; // differ from initial inserted keys
			policy.onSet(String(entry.value), entry, { totalEntriesNo: i });
		}

		// assert it evicted keys inserted above, and not the initial ones
		expect(keysEvictedByPolicy).to.be.ofSize(capacity);
		expect(keysEvictedByPolicy).to.be.containingAllOf(range(capacity, capacity * 2).map(String));
	});
});

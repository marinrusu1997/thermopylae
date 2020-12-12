import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import { UnitTestLogger } from '@thermopylae/lib.unit-test/dist/logger';
import { number } from '@thermopylae/lib.utils';
import colors from 'colors';
import { Nullable } from '@thermopylae/core.declarations';
import { EvictableKeyNode, LFUEvictionPolicy } from '../../../lib/policies/eviction/lfu-eviction-policy';
import { SetOperationContext } from '../../../lib/contracts/cache-policy';

describe.only(`${colors.magenta(LFUEvictionPolicy.name)} spec`, () => {
	it('should not evict entries until capacity cap is met', () => {
		const capacity = number.randomInt(1, 10);
		try {
			const lfu = new LFUEvictionPolicy<string, number>(capacity);
			const candidates = new Map<string, number>();
			for (let i = 0; i < capacity; i++) {
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
			const entry: EvictableKeyNode<string, number> = { key: String(capacity + 1), value: capacity + 1 };
			let deleted: Nullable<string> = null;
			lfu.setDeleter((key) => {
				deleted = key;
			});

			lfu.onSet(entry.key, entry, context);

			expect(deleted).to.not.be.eq(null); // our deleter has been called...
			expect(deleted).to.not.be.eq(entry.key); // ...on some random entry (all of them have 0 frequency)...
			expect(lfu.size).to.be.eq(context.totalEntriesNo); // ...and number of req nodes remained the same
		} catch (e) {
			UnitTestLogger.info(`Cache capacity: ${String(capacity).magenta}.`); // so we can replicate it
			throw e;
		}
	});

	it('should evict least frequently used item', () => {
		throw new Error('NOT IMPLEMENTED');
	});

	it(`should evict when ${'cache capacity is 1'.magenta}`, () => {
		throw new Error('NOT IMPLEMENTED');
	});

	it(`should evict least recently used item when ${'all items have same frequency'.magenta}`, () => {
		throw new Error('NOT IMPLEMENTED');
	});

	it(`should evict least recently used item when ${'least frequency is shared by multiple entries'.magenta}`, () => {
		throw new Error('NOT IMPLEMENTED');
	});
});

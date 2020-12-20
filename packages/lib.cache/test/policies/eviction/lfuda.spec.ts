import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import colors from 'colors';
import { array, number } from '@thermopylae/lib.utils';
import { UnitTestLogger } from '@thermopylae/lib.unit-test/dist/logger';
import { LFUDAEvictionPolicy } from '../../../lib/policies/eviction/lfuda';
import { BaseLFUEvictionPolicy, EvictableKeyNode } from '../../../lib/policies/eviction/lfu-base';
import { SetOperationContext } from '../../../lib/contracts/cache-policy';

// const BUCKET_FORMATTERS = [colors.magenta, colors.green, colors.blue, colors.red];

describe(`${colors.magenta(LFUDAEvictionPolicy.name)} spec`, () => {
	it('replaces stale popular entries', () => {
		const ENTRIES = new Map<string, number>([
			['a', 0],
			['b', 1],
			['c', 2],
			['d', 3],
			['e', 4],
			['f', 5],
			['g', 6]
		]);
		const ENTRY_FREQ = new Map<string, number>([
			['a', 2],
			['b', 2],
			['c', 4],
			['d', 4],
			['e', 6],
			['f', 7],
			['g', 10]
		]);
		const CAPACITY = ENTRIES.size;

		// @fixme causes fail: c,b,d,g,f,f,g,g,d,e,g,g,e,e,c,e,f,g,b,f,g,e,d,a,e,f,g,g,g,f,d,f,a,c,c
		// @fixme causes fail: d,e,c,g,g,f,a,f,g,g,g,d,e,c,a,g,e,b,e,g,f,b,e,d,c,e,d,f,c,g,f,g,f,g,f
		// @fixme causes fail: c,e,f,c,g,g,a,g,e,f,b,e,g,g,a,d,c,g,f,b,g,e,f,f,e,g,f,f,e,g,c,g,d,d,d
		// @fixme causes fail: a,a,g,d,c,c,e,b,e,f,b,e,f,d,g,c,c,f,e,d,f,d,g,g,g,e,g,e,g,f,g,g,f,g,f
		// @fixme causes fail: b,b,d,g,f,a,g,c,f,e,f,g,f,g,f,a,f,g,g,e,f,c,g,c,c,e,e,e,d,d,g,d,e,g,g
		// @fixme causes fail: g,e,g,c,a,e,g,b,f,e,f,d,d,c,g,f,g,f,a,e,g,c,d,c,f,d,e,b,f,g,f,e,g,g,g
		const GET_ORDER = array.shuffle([...ENTRY_FREQ.keys()].map((k) => array.filledWith(ENTRY_FREQ.get(k)!, k)).flat());

		const ADDITIONAL_ENTRIES = new Map<string, number>([
			['h', 7],
			['i', 8]
		]);

		const EVICTED_KEYS = new Array<string>();

		try {
			const lfu = new LFUDAEvictionPolicy<string, number>(CAPACITY);
			const lfuEntries = new Map<string, EvictableKeyNode<string, number>>();
			lfu.setDeleter((key) => EVICTED_KEYS.push(key));

			/* Add entries */
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

			/* Set their frequencies */
			for (const key of GET_ORDER) {
				const entry = lfuEntries.get(key);
				if (entry == null) {
					throw new Error(`Could not find entry for ${key.magenta}.`);
				}
				lfu.onGet(key, entry);
			}

			/* Add additional entries */
			for (const [key, value] of ADDITIONAL_ENTRIES) {
				// @ts-ignore
				const entry: EvictableKeyNode<string, number> = { key, value };
				lfu.onSet(key, entry, context);
				lfuEntries.set(key, entry);
			}
			expect(lfu.size).to.be.eq(CAPACITY);
			expect(EVICTED_KEYS).to.be.ofSize(ADDITIONAL_ENTRIES.size);
			expect(EVICTED_KEYS).to.be.containingAllOf(['a', 'b']);

			/* Set additional entries frequency */
			for (const key of ADDITIONAL_ENTRIES.keys()) {
				const entry = lfuEntries.get(key);
				if (entry == null) {
					throw new Error(`Could not find entry for ${key.magenta}.`);
				}

				let freq = 4;
				while (freq--) {
					lfu.onGet(key, entry);
				}
				expect(BaseLFUEvictionPolicy.frequency(entry)).to.be.eq(14); // 2 + freq(4) * (cache age(2) + 1)
			}
			expect(lfu.size).to.be.eq(CAPACITY);
			expect(EVICTED_KEYS).to.be.ofSize(ADDITIONAL_ENTRIES.size);
			expect(EVICTED_KEYS).to.be.containingAllOf(['a', 'b']);

			// @ts-ignore
			const entry: EvictableKeyNode<string, number> = { key: 'x', value: number.randomInt(10, 20) };
			lfu.onSet('x', entry, context);

			expect(EVICTED_KEYS).to.be.ofSize(ADDITIONAL_ENTRIES.size + 1);
			expect(EVICTED_KEYS).to.be.containingAllOf(['a', 'b', 'd']); // c has been inserted before d, and was removed first
		} catch (e) {
			const message = ['Test Context:', `${'GET_ORDER'.magenta}: ${GET_ORDER}`];
			UnitTestLogger.info(message.join('\n'));
			throw e;
		}
	});
});

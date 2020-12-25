import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import colors from 'colors';
import { array, number } from '@thermopylae/lib.utils';
import { UnitTestLogger } from '@thermopylae/lib.unit-test/dist/logger';
import { LFUDAEvictionPolicy } from '../../../lib/policies/eviction/lfuda';
import { EvictableKeyNode } from '../../../lib/policies/eviction/lfu-base';
import { SetOperationContext } from '../../../lib/contracts/replacement-policy';

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
				lfu.onHit(key, entry);
			}
			for (const [key, freq] of ENTRY_FREQ) {
				const entry = lfuEntries.get(key)!;
				expect(LFUDAEvictionPolicy.frequency(entry)).to.be.eq(freq);
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
					lfu.onHit(key, entry);
				}
				expect(LFUDAEvictionPolicy.frequency(entry)).to.be.eq(14); // 2 + freq(4) * (cache age(2) + 1)
			}
			expect(lfu.size).to.be.eq(CAPACITY);
			expect(EVICTED_KEYS).to.be.ofSize(ADDITIONAL_ENTRIES.size);
			expect(EVICTED_KEYS).to.be.containingAllOf(['a', 'b']);

			// @ts-ignore
			const entry: EvictableKeyNode<string, number> = { key: 'x', value: number.randomInt(10, 20) };
			lfu.onSet('x', entry, context);

			expect(EVICTED_KEYS).to.be.ofSize(ADDITIONAL_ENTRIES.size + 1);
			expect(EVICTED_KEYS).to.satisfy((keys: string[]) => keys.includes('c') || keys.includes('d'));
		} catch (e) {
			const message = ['Test Context:', `${'GET_ORDER'.magenta}: ${GET_ORDER.map((v) => `'${v}'`)}`];
			UnitTestLogger.info(message.join('\n'));
			throw e;
		}
	});
});

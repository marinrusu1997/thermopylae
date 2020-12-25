import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import colors from 'colors';
import { array, number, string } from '@thermopylae/lib.utils';
import { UnitTestLogger } from '@thermopylae/lib.unit-test/dist/logger';
import { EvictableKeyNode } from '../../../lib/policies/eviction/lfu-base';
import { SetOperationContext } from '../../../lib/contracts/replacement-policy';
import { GDSFEvictionPolicy } from '../../../lib/policies/eviction/gdsf';

// const BUCKET_FORMATTERS = [colors.magenta, colors.green, colors.blue, colors.red];

describe(`${colors.magenta(GDSFEvictionPolicy.name)} spec`, () => {
	it('calculates priorities based on value size in bytes', () => {
		const ENTRIES = new Map<string, string>([
			['a', string.random({ length: number.randomInt(0, 100) })],
			['b', string.random({ length: number.randomInt(0, 100) })],
			['c', string.random({ length: number.randomInt(101, 1000) })],
			['d', string.random({ length: number.randomInt(0, 100) })],
			['e', string.random({ length: number.randomInt(101, 1000) })],
			['f', string.random({ length: number.randomInt(0, 100) })],
			['g', string.random({ length: number.randomInt(1001, 5000) })]
		]);

		const CAPACITY = ENTRIES.size;
		const FREQ = 100;

		const GET_ORDER = array.shuffle([...ENTRIES.keys()].map((k) => array.filledWith(FREQ, k)).flat());

		const ADDITIONAL_ENTRIES = new Map<string, string>([
			['h', 'high priority'],
			['i', 'high priority too'],
			['k', 'very high'],
			['l', 'highest']
		]);

		const EVICTED_KEYS = new Array<string>();

		try {
			const lfu = new GDSFEvictionPolicy<string, string>(CAPACITY);
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

			/* Set their initial frequencies */
			for (const key of GET_ORDER) {
				const entry = lfuEntries.get(key);
				if (entry == null) {
					throw new Error(`Could not find entry for ${key.magenta}.`);
				}
				lfu.onHit(key, entry);
			}

			/* Add additional entries */
			for (const [key, value] of ADDITIONAL_ENTRIES) {
				// @ts-ignore
				const entry: EvictableKeyNode<string, number> = { key, value };
				lfu.onSet(key, entry, context);
				lfuEntries.set(key, entry);

				for (let i = 0; i < FREQ; i++) {
					lfu.onHit(key, entry);
				}
			}
			expect(lfu.size).to.be.eq(CAPACITY);

			expect(EVICTED_KEYS).to.be.ofSize(ADDITIONAL_ENTRIES.size);
			expect(Array.from(ENTRIES.keys())).to.be.containingAllOf(EVICTED_KEYS);

			expect(GDSFEvictionPolicy.frequency(lfuEntries.get('k')!)).to.be.eq(2.1);
			expect(GDSFEvictionPolicy.frequency(lfuEntries.get('i')!)).to.be.eq(2.1);
			expect(GDSFEvictionPolicy.frequency(lfuEntries.get('h')!)).to.be.eq(2.1);
			expect(GDSFEvictionPolicy.frequency(lfuEntries.get('h')!)).to.be.eq(2.1);
		} catch (e) {
			const message = [
				'Test Context:',
				`${'CAPACITY'.magenta}\t\t\t\t: ${CAPACITY}`,
				'\n',
				`${'ENTRIES'.magenta}\t\t\t\t\t: ${JSON.stringify([...ENTRIES].map(([k, v]) => [k, v.length]))}`,
				'\n',
				`${'EVICTED_KEYS'.magenta}\t\t\t\t: ${JSON.stringify(EVICTED_KEYS)}`
			];
			UnitTestLogger.info(message.join('\n'));
			throw e;
		}
	});
});

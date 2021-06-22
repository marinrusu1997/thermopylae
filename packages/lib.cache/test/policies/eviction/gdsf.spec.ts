import { describe, it } from 'mocha';
import { expect, logger } from '@thermopylae/lib.unit-test';
import colors from 'colors';
import { array, number, string } from '@thermopylae/lib.utils';
import { EvictableCacheEntry } from '../../../lib/policies/eviction/lfu-base';
import { GDSFEvictionPolicy } from '../../../lib';
import { BUCKET_HEADER_SYM } from '../../../lib/data-structures/bucket-list/ordered-bucket-list';

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
			let totalEntriesNo = 0;

			const policy = new GDSFEvictionPolicy<string, number, any>(CAPACITY, {
				get size() {
					return totalEntriesNo;
				}
			});
			const lfuEntries = new Map<string, EvictableCacheEntry<string, number>>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);
				policy.onDelete(evictedEntry as any);
			});

			/* Add entries */
			for (const [key, value] of ENTRIES) {
				// @ts-ignore
				const entry: EvictableCacheEntry<string, number> = { key, value };
				policy.onSet(entry);
				lfuEntries.set(key, entry);
				totalEntriesNo += 1;
			}
			expect(policy.size).to.be.eq(CAPACITY);
			expect(totalEntriesNo).to.be.eq(CAPACITY);

			/* Set their initial frequencies */
			for (const key of GET_ORDER) {
				const entry = lfuEntries.get(key);
				if (entry == null) {
					throw new Error(`Could not find entry for ${key.magenta}.`);
				}
				policy.onHit(entry);
			}

			totalEntriesNo += 1; // simulate overflow

			/* Add additional entries */
			for (const [key, value] of ADDITIONAL_ENTRIES) {
				// @ts-ignore
				const entry: EvictableCacheEntry<string, number> = { key, value };
				policy.onSet(entry);
				lfuEntries.set(key, entry);

				for (let i = 0; i < FREQ; i++) {
					policy.onHit(entry);
				}
			}
			expect(policy.size).to.be.eq(CAPACITY);

			expect(EVICTED_KEYS).to.be.ofSize(ADDITIONAL_ENTRIES.size);
			expect(Array.from(ENTRIES.keys())).to.be.containingAllOf(EVICTED_KEYS);

			expect(lfuEntries.get('k')![BUCKET_HEADER_SYM].id).to.be.eq(2.1);
			expect(lfuEntries.get('i')![BUCKET_HEADER_SYM].id).to.be.eq(2.1);
			expect(lfuEntries.get('h')![BUCKET_HEADER_SYM].id).to.be.eq(2.1);
			expect(lfuEntries.get('h')![BUCKET_HEADER_SYM].id).to.be.eq(2.1);
		} catch (e) {
			const message = [
				'Test Context:',
				`${'CAPACITY'.magenta}\t\t\t\t: ${CAPACITY}`,
				'\n',
				`${'ENTRIES'.magenta}\t\t\t\t\t: ${JSON.stringify([...ENTRIES].map(([k, v]) => [k, v.length]))}`,
				'\n',
				`${'EVICTED_KEYS'.magenta}\t\t\t\t: ${JSON.stringify(EVICTED_KEYS)}`
			];
			logger.info(message.join('\n'));
			throw e;
		}
	});

	it("recomputes priority when value changes in the 'onUpdate' hook", () => {
		let totalEntriesNo = 0;

		const policy = new GDSFEvictionPolicy<string, string, any>(1, {
			get size() {
				return totalEntriesNo;
			}
		});

		// @ts-ignore
		const entry: EvictableCacheEntry<string, string> = { key: 'key', value: 'value' };
		policy.onSet(entry);
		totalEntriesNo += 1;
		expect(entry[BUCKET_HEADER_SYM].id).to.be.eq(0);

		entry.value = string.random({ length: 100 });
		policy.onUpdate(entry);
		expect(entry[BUCKET_HEADER_SYM].id).to.be.eq(1);
		expect(policy.size).to.be.eq(1);
	});
});

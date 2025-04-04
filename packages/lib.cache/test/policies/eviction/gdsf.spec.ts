import { logger } from '@thermopylae/dev.unit-test';
import colors from 'colors';
import cryptoRandomString from 'crypto-random-string';
import shuffle from 'knuth-shuffle-seeded';
import { randomInt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BUCKET_HEADER_SYM } from '../../../lib/data-structures/bucket-list/ordered-bucket-list.js';
import { GDSFEvictionPolicy } from '../../../lib/index.js';
import type { EvictableCacheEntry } from '../../../lib/policies/eviction/lfu-base.js';

// const BUCKET_FORMATTERS = [colors.magenta, colors.green, colors.blue, colors.red];

describe(`${colors.magenta(GDSFEvictionPolicy.name)} spec`, () => {
	it('calculates priorities based on value size in bytes', () => {
		expect.hasAssertions();

		const ENTRIES = new Map<string, string>([
			['a', cryptoRandomString({ length: randomInt(0, 100) })],
			['b', cryptoRandomString({ length: randomInt(0, 100) })],
			['c', cryptoRandomString({ length: randomInt(101, 1000) })],
			['d', cryptoRandomString({ length: randomInt(0, 100) })],
			['e', cryptoRandomString({ length: randomInt(101, 1000) })],
			['f', cryptoRandomString({ length: randomInt(0, 100) })],
			['g', cryptoRandomString({ length: randomInt(1001, 5000) })]
		]);

		const CAPACITY = ENTRIES.size;
		const FREQ = 100;

		const GET_ORDER = shuffle(
			ENTRIES.keys()
				.flatMap((k) => new Array(FREQ).fill(k))
				.toArray()
		);

		const ADDITIONAL_ENTRIES = new Map<string, string>([
			['h', 'high priority'],
			['i', 'high priority too'],
			['k', 'very high'],
			['l', 'highest']
		]);

		const EVICTED_KEYS = new Array<string>();

		try {
			let totalEntriesNo = 0;

			const policy = new GDSFEvictionPolicy<string, number, unknown>(CAPACITY, {
				get size() {
					return totalEntriesNo;
				}
			});
			const lfuEntries = new Map<string, EvictableCacheEntry<string, number>>();
			const getEntry = (key: string) => {
				const entry = lfuEntries.get(key);
				if (!entry) {
					throw new Error(`No entry for key '${key}'`);
				}
				return entry;
			};

			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);
				policy.onDelete(evictedEntry as EvictableCacheEntry<string, number>);
			});

			/* Add entries */
			for (const [key, value] of ENTRIES) {
				// @ts-expect-error This is for testing purposesrposes
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
				// @ts-expect-error This is for testing purposesrposes
				const entry: EvictableCacheEntry<string, number> = { key, value };
				policy.onSet(entry);
				lfuEntries.set(key, entry);

				for (let i = 0; i < FREQ; i++) {
					policy.onHit(entry);
				}
			}
			expect(policy.size).to.be.eq(CAPACITY);

			expect(EVICTED_KEYS).to.have.length(ADDITIONAL_ENTRIES.size);
			expect([...ENTRIES.keys()]).to.containSubset(EVICTED_KEYS);

			expect(getEntry('k')[BUCKET_HEADER_SYM].id).to.be.eq(2.1);
			expect(getEntry('i')[BUCKET_HEADER_SYM].id).to.be.eq(2.1);
			expect(getEntry('h')[BUCKET_HEADER_SYM].id).to.be.eq(2.1);
			expect(getEntry('h')[BUCKET_HEADER_SYM].id).to.be.eq(2.1);
		} catch (error) {
			const message = [
				'Test Context:',
				`${'CAPACITY'.magenta}\t\t\t\t: ${CAPACITY}`,
				'\n',
				`${'ENTRIES'.magenta}\t\t\t\t\t: ${JSON.stringify([...ENTRIES].map(([k, v]) => [k, v.length]))}`,
				'\n',
				`${'EVICTED_KEYS'.magenta}\t\t\t\t: ${JSON.stringify(EVICTED_KEYS)}`
			];
			logger.info(message.join('\n'));
			throw error;
		}
	});

	it("recomputes priority when value changes in the 'onUpdate' hook", () => {
		let totalEntriesNo = 0;

		const policy = new GDSFEvictionPolicy<string, string, unknown>(1, {
			get size() {
				return totalEntriesNo;
			}
		});

		// @ts-expect-error This is for testing purposesrposes
		const entry: EvictableCacheEntry<string, string> = { key: 'key', value: 'value' };
		policy.onSet(entry);
		totalEntriesNo += 1;
		expect(entry[BUCKET_HEADER_SYM].id).to.be.eq(0);

		entry.value = cryptoRandomString({ length: 100 });
		policy.onUpdate(entry);
		expect(entry[BUCKET_HEADER_SYM].id).to.be.eq(1);
		expect(policy.size).to.be.eq(1);
	});
});

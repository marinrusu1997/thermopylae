import { logger } from '@thermopylae/dev.unit-test';
import { array, number } from '@thermopylae/lib.utils';
import colors from 'colors';
import { describe, expect, it } from 'vitest';
import { BUCKET_HEADER_SYM } from '../../../lib/data-structures/bucket-list/ordered-bucket-list.js';
import { LFUDAEvictionPolicy } from '../../../lib/index.js';
import type { EvictableCacheEntry } from '../../../lib/policies/eviction/lfu-base.js';

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
			let totalEntriesNo = 0;

			const policy = new LFUDAEvictionPolicy<string, number, any>(CAPACITY, {
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
				// @ts-ignore This is for testing purposes
				const entry: EvictableCacheEntry<string, number> = { key, value };
				policy.onSet(entry);
				lfuEntries.set(key, entry);
				totalEntriesNo += 1;
			}
			expect(policy.size).to.be.eq(CAPACITY);
			expect(totalEntriesNo).to.be.eq(CAPACITY);

			/* Set their frequencies */
			for (const key of GET_ORDER) {
				const entry = lfuEntries.get(key);
				if (entry == null) {
					throw new Error(`Could not find entry for ${key.magenta}.`);
				}
				policy.onHit(entry);
			}
			for (const [key, freq] of ENTRY_FREQ) {
				const entry = lfuEntries.get(key)!;
				expect(entry[BUCKET_HEADER_SYM].id).to.be.eq(freq);
			}

			totalEntriesNo += 1; // simulate overflow

			/* Add additional entries */
			for (const [key, value] of ADDITIONAL_ENTRIES) {
				// @ts-ignore This is for testing purposes
				const entry: EvictableCacheEntry<string, number> = { key, value };
				policy.onSet(entry);
				lfuEntries.set(key, entry);
			}
			expect(policy.size).to.be.eq(CAPACITY);
			expect(EVICTED_KEYS).to.have.length(ADDITIONAL_ENTRIES.size);
			expect(EVICTED_KEYS).to.containSubset(['a', 'b']);

			/* Set additional entries frequency */
			for (const key of ADDITIONAL_ENTRIES.keys()) {
				const entry = lfuEntries.get(key);
				if (entry == null) {
					throw new Error(`Could not find entry for ${key.magenta}.`);
				}

				let freq = 4;
				while (freq--) {
					policy.onHit(entry);
				}
				expect(entry[BUCKET_HEADER_SYM].id).to.be.eq(14); // 2 + freq(4) * (cache age(2) + 1)
			}
			expect(policy.size).to.be.eq(CAPACITY);
			expect(EVICTED_KEYS).to.have.length(ADDITIONAL_ENTRIES.size);
			expect(EVICTED_KEYS).to.containSubset(['a', 'b']);

			// @ts-ignore This is for testing purposes
			const entry: EvictableCacheEntry<string, number> = { key: 'x', value: number.randomInt(10, 20) };
			policy.onSet(entry);

			expect(EVICTED_KEYS).to.have.length(ADDITIONAL_ENTRIES.size + 1);
			expect(EVICTED_KEYS).to.satisfy((keys: string[]) => keys.includes('c') || keys.includes('d'));
		} catch (e) {
			const message = ['Test Context:', `${'GET_ORDER'.magenta}: ${GET_ORDER.map((v) => `'${v}'`)}`];
			logger.info(message.join('\n'));
			throw e;
		}
	});
});

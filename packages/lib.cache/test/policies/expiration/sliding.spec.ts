import { describe, it } from 'mocha';
import colors from 'colors';
import { array } from '@thermopylae/lib.utils';
import { expect } from '@thermopylae/lib.unit-test';
import { ExpirableSlidingCacheEntry, SlidingProactiveExpirationPolicy, TIME_SPAN_SYM } from '../../../lib/policies/expiration/sliding';
import { EXPIRES_AT_SYM, INFINITE_EXPIRATION } from '../../../lib/constants';
import { EntryValidity } from '../../../lib/contracts/replacement-policy';

function generateEntry(): ExpirableSlidingCacheEntry<string, any> {
	return {
		key: '',
		value: array.randomElement(generateEntry.VALUES)
	};
}
generateEntry.VALUES = [undefined, null, false, 0, '', {}, []];

// @fixme integral test with random scenaries

describe.only(`${colors.magenta(SlidingProactiveExpirationPolicy.name)} spec`, () => {
	describe(`${SlidingProactiveExpirationPolicy.prototype.onGet.name.magenta} spec`, () => {
		it('validates entries that have no time span expiration', (done) => {
			const ENTRIES = new Map<string, ExpirableSlidingCacheEntry<string, any>>([
				['1', generateEntry()],
				['2', generateEntry()],
				['3', generateEntry()],
				['4', generateEntry()]
			]);

			const policy = new SlidingProactiveExpirationPolicy<string, any>();
			const EVICTED_KEYS = new Set<string>();
			policy.setDeleter((key) => {
				EVICTED_KEYS.add(key);
			});

			policy.onSet('1', ENTRIES.get('1')!);
			policy.onSet('2', ENTRIES.get('2')!, { timeSpan: undefined });
			policy.onSet('3', ENTRIES.get('3')!, { timeSpan: null! });
			policy.onSet('4', ENTRIES.get('4')!, { timeSpan: INFINITE_EXPIRATION });

			for (const [key, entry] of ENTRIES.entries()) {
				expect(entry[TIME_SPAN_SYM]).to.be.eq(undefined);
				expect(entry[EXPIRES_AT_SYM]).to.be.eq(undefined);
				expect(policy.onGet(key, entry)).to.be.eq(EntryValidity.VALID);
			}
			expect(policy.idle).to.be.eq(true);

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS.size).to.be.eq(0);
					expect(policy.idle).to.be.eq(true);

					done();
				} catch (e) {
					done(e);
				}
			}, 50);
		});

		it('refreshes expiration with the time span on each entry hit', (done) => {
			const policy = new SlidingProactiveExpirationPolicy<string, any>();
			const EVICTED_KEYS = new Set<string>();
			policy.setDeleter((evictedKey, evictedEntry) => {
				const slidingEntry = evictedEntry as ExpirableSlidingCacheEntry<string, any>;

				EVICTED_KEYS.add(evictedKey);
				policy.onDelete(evictedKey, slidingEntry);

				expect(slidingEntry[EXPIRES_AT_SYM]).to.be.eq(undefined);
				expect(slidingEntry[TIME_SPAN_SYM]).to.be.eq(undefined);
			});

			const ENTRY = generateEntry();
			policy.onSet('key', ENTRY, { timeSpan: 2 });

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS.size).to.be.eq(0);
					expect(policy.idle).to.be.eq(false);
					expect(policy.onGet('key', ENTRY)).to.be.eq(EntryValidity.VALID); // refresh expiration
				} catch (e) {
					clearTimeout(entrySlicedTimeout);
					clearTimeout(entryEvictedTimeout);
					done(e);
				}
			}, 1000);

			const entrySlicedTimeout = setTimeout(() => {
				try {
					// it was refreshed and will expire later
					expect(EVICTED_KEYS.size).to.be.eq(0);
					expect(policy.idle).to.be.eq(false);
				} catch (e) {
					clearTimeout(entryEvictedTimeout);
					done(e);
				}
			}, 2100);

			const entryEvictedTimeout = setTimeout(() => {
				try {
					expect(EVICTED_KEYS.size).to.be.eq(1);
					expect(EVICTED_KEYS.has('key')).to.be.eq(true);
					expect(policy.idle).to.be.eq(true);

					done();
				} catch (e) {
					done(e);
				}
			}, 3200);
		}).timeout(3500);
	});

	describe(`${SlidingProactiveExpirationPolicy.prototype.onSet.name.magenta} spec`, () => {});
});

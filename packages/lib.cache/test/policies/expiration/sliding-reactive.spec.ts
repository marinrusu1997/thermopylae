import { describe, it } from 'mocha';
import colors from 'colors';
import { expect } from '@thermopylae/dev.unit-test';
import { chrono } from '@thermopylae/lib.utils';
import { ExpirableSlidingCacheEntry, SlidingReactiveExpirationPolicy, TIME_SPAN_SYM } from '../../../lib/policies/expiration/sliding-reactive';
import { EXPIRES_AT_SYM, INFINITE_EXPIRATION } from '../../../lib/constants';
import { EntryValidity } from '../../../lib';

describe(`${colors.magenta(SlidingReactiveExpirationPolicy.name)} spec`, () => {
	it('should work', async () => {
		const policy = new SlidingReactiveExpirationPolicy<string, string>();
		const EVICTED_KEYS = new Array<string>();
		policy.setDeleter((entry) => {
			EVICTED_KEYS.push(entry.key);

			const slidingEntry = entry as ExpirableSlidingCacheEntry<string, string>;
			policy.onDelete(slidingEntry);
			expect(slidingEntry[EXPIRES_AT_SYM]).to.be.eq(undefined);
			expect(slidingEntry[TIME_SPAN_SYM]).to.be.eq(undefined);
		});

		const entry: ExpirableSlidingCacheEntry<string, string> = {
			key: 'key',
			value: 'value'
		};

		policy.onSet(entry, { timeSpan: 2 });
		expect(typeof entry[EXPIRES_AT_SYM]).to.be.eq('number');
		expect(typeof entry[TIME_SPAN_SYM]).to.be.eq('number');

		policy.onSet(entry); // has no effect
		policy.onSet(entry, { timeSpan: undefined }); // has no effect
		policy.onSet(entry, { timeSpan: INFINITE_EXPIRATION }); // has no effect

		await chrono.sleep(1000);
		expect(EVICTED_KEYS).to.be.ofSize(0);
		expect(policy.onHit(entry)).to.be.eq(EntryValidity.VALID); // increase with another 2 sec

		await chrono.sleep(2010);
		expect(EVICTED_KEYS).to.be.ofSize(0);
		expect(policy.onHit(entry)).to.be.eq(EntryValidity.NOT_VALID);
		expect(EVICTED_KEYS).to.be.ofSize(1);

		expect(policy.onHit(entry)).to.be.eq(EntryValidity.VALID); // it has no metadata

		policy.onUpdate(entry, { timeSpan: 5 }); // set time span
		expect(typeof entry[EXPIRES_AT_SYM]).to.be.eq('number');
		expect(typeof entry[TIME_SPAN_SYM]).to.be.eq('number');

		policy.onUpdate(entry); // has no effect
		policy.onUpdate(entry, { timeSpan: undefined }); // has no effect
		expect(typeof entry[EXPIRES_AT_SYM]).to.be.eq('number');
		expect(typeof entry[TIME_SPAN_SYM]).to.be.eq('number');

		policy.onUpdate(entry, { timeSpan: INFINITE_EXPIRATION }); // remove time span
		expect(entry[EXPIRES_AT_SYM]).to.be.eq(undefined);
		expect(entry[TIME_SPAN_SYM]).to.be.eq(undefined);

		policy.onUpdate(entry, { timeSpan: 5 }); // set time span back
		policy.onUpdate(entry, { timeSpan: 1 }); // decrease time span

		await chrono.sleep(500);
		policy.onUpdate(entry, { timeSpan: 1 }); // has no effect because it's same time span

		await chrono.sleep(510);
		expect(policy.onHit(entry)).to.be.eq(EntryValidity.NOT_VALID);
		expect(EVICTED_KEYS).to.be.equalTo(['key', 'key']);

		policy.onClear(); // has no effect
	}).timeout(4500);
});

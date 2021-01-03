import { describe, it } from 'mocha';
import colors from 'colors';
import { array, chrono } from '@thermopylae/lib.utils';
import { expect } from '@thermopylae/lib.unit-test';
import { ReactiveExpirationPolicy } from '../../../lib/policies/expiration/reactive';
import { ExpirableCacheEntry, EXPIRES_AT_SYM } from '../../../lib/policies/expiration/abstract';
import { EntryValidity, SetOperationContext } from '../../../lib/contracts/replacement-policy';
import { generateSetContext } from './commons';
import { INFINITE_TTL } from '../../../lib/constants';

function generateEntry(): ExpirableCacheEntry<any> {
	return {
		value: array.randomElement(generateEntry.VALUES)
	};
}
generateEntry.VALUES = [undefined, null, false, 0, '', {}, []];

describe(`${colors.magenta(ReactiveExpirationPolicy.name)} spec`, () => {
	describe(`${ReactiveExpirationPolicy.prototype.onSet.name.magenta} spec`, () => {
		it('should set entry entry expiration and evict it if expired on hit', (done) => {
			const policy = new ReactiveExpirationPolicy<string, any>();
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((key) => EVICTED_KEYS.push(key));

			const KEY = 'a';
			const ENTRY = generateEntry();
			const TTL = 1;
			policy.onSet(KEY, ENTRY, generateSetContext(TTL));

			expect(policy.onHit(KEY, ENTRY)).to.be.eq(EntryValidity.VALID);
			expect(EVICTED_KEYS).to.be.ofSize(0); // entry is still valid

			setTimeout(() => {
				try {
					expect(policy.onHit(KEY, ENTRY)).to.be.eq(EntryValidity.VALID);
					expect(EVICTED_KEYS).to.be.ofSize(0);
				} catch (e) {
					clearTimeout(timeoutExpired);
					done(e);
				}
			}, chrono.secondsToMilliseconds(TTL / 2) + 20);

			const timeoutExpired = setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(0); // entry is still valid
					expect(policy.onHit(KEY, ENTRY)).to.be.eq(EntryValidity.NOT_VALID);
					expect(EVICTED_KEYS).to.be.ofSize(1); // entry was evicted
					expect(ENTRY[EXPIRES_AT_SYM]).to.be.eq(undefined); // and metadata was removed
					done();
				} catch (e) {
					done(e);
				}
			}, chrono.secondsToMilliseconds(TTL) + 20);
		});

		it('should evict items even when have negative ttl, but increased expires from', (done) => {
			const policy = new ReactiveExpirationPolicy<string, any>();
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((key) => EVICTED_KEYS.push(key));

			const KEY = 'a';
			const ENTRY = generateEntry();
			const TTL = -1;
			const EXPIRES_FROM = chrono.unixTime() + 2;
			policy.onSet(KEY, ENTRY, generateSetContext(TTL, EXPIRES_FROM));

			expect(policy.onHit(KEY, ENTRY)).to.be.eq(EntryValidity.VALID);
			expect(EVICTED_KEYS).to.be.ofSize(0); // entry is still valid

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(0); // entry is still valid
					expect(policy.onHit(KEY, ENTRY)).to.be.eq(EntryValidity.NOT_VALID);
					expect(EVICTED_KEYS).to.be.ofSize(1); // entry was evicted
					expect(ENTRY[EXPIRES_AT_SYM]).to.be.eq(undefined); // and metadata was removed
					done();
				} catch (e) {
					done(e);
				}
			}, chrono.secondsToMilliseconds(Math.abs(TTL)) + 20);
		});

		it("should not set entry expiration and don't evict it if has infinite or no ttl", (done) => {
			const policy = new ReactiveExpirationPolicy<string, any>();
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((key) => EVICTED_KEYS.push(key));

			const ENTRIES = new Map<string, [ExpirableCacheEntry<any>, SetOperationContext]>([
				['a', [generateEntry(), generateSetContext(INFINITE_TTL)]],
				['b', [generateEntry(), generateSetContext(null)]],
				['c', [generateEntry(), generateSetContext(undefined)]]
			]);

			for (const [key, [entry, context]] of ENTRIES) {
				policy.onSet(key, entry, context);
			}

			for (const [key, [entry]] of ENTRIES) {
				expect(policy.onHit(key, entry)).to.be.eq(EntryValidity.VALID);
				expect(EVICTED_KEYS).to.be.ofSize(0);
			}

			setTimeout(() => {
				try {
					for (const [key, [entry]] of ENTRIES) {
						expect(policy.onHit(key, entry)).to.be.eq(EntryValidity.VALID);
						expect(EVICTED_KEYS).to.be.ofSize(0);
					}

					done();
				} catch (e) {
					done(e);
				}
			}, 100);
		});
	});

	describe(`${ReactiveExpirationPolicy.prototype.onUpdate.name.magenta} spec`, () => {
		it('should update timeout when it increases/decreases', (done) => {
			const policy = new ReactiveExpirationPolicy<string, any>();
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((key) => EVICTED_KEYS.push(key));

			const ENTRY = generateEntry();
			policy.onSet('a', ENTRY, generateSetContext(2)); // original
			policy.onSet('a', ENTRY, generateSetContext(3)); // increase
			policy.onSet('a', ENTRY, generateSetContext(1)); // decrease

			expect(policy.onHit('a', ENTRY)).to.be.eq(EntryValidity.VALID);

			setTimeout(() => {
				try {
					expect(policy.onHit('a', ENTRY)).to.be.eq(EntryValidity.NOT_VALID);
					expect(EVICTED_KEYS).to.be.containingAllOf(['a']);
					done();
				} catch (e) {
					done(e);
				}
			}, 1050);
		});

		it('should update timeout when it is set/unset', () => {
			const policy = new ReactiveExpirationPolicy<string, any>();
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((key) => EVICTED_KEYS.push(key));

			const ENTRY = generateEntry();
			const now = chrono.unixTime();
			policy.onUpdate('a', ENTRY, generateSetContext(1));
			expect(ENTRY[EXPIRES_AT_SYM]).to.not.be.greaterThan(now + 1 + 1); // 1 sec for epsilon in case `now` will differ

			policy.onUpdate('a', ENTRY, generateSetContext(null));
			expect(ENTRY[EXPIRES_AT_SYM]).to.be.eq(undefined);

			policy.onUpdate('a', ENTRY, generateSetContext(-1, now + 1));
			expect(ENTRY[EXPIRES_AT_SYM]).to.not.be.greaterThan(now + 1); // 1 sec for epsilon in case `now` will differ

			expect(policy.onHit('a', ENTRY)).to.be.eq(EntryValidity.NOT_VALID);
			expect(ENTRY[EXPIRES_AT_SYM]).to.be.eq(undefined);
			expect(EVICTED_KEYS).to.be.ofSize(1);
			expect(EVICTED_KEYS).to.be.containingAllOf(['a']);
		});
	});

	describe(`${ReactiveExpirationPolicy.prototype.onDelete.name.magenta} spec`, () => {
		it('requires entry on deletion', () => {
			const policy = new ReactiveExpirationPolicy<string, any>();
			expect(policy.requiresEntryOnDeletion).to.be.eq(true);
		});

		it('removes metadata when entry is deleted explicitly', () => {
			const policy = new ReactiveExpirationPolicy<string, any>();

			const ENTRY = generateEntry();
			policy.onSet('a', ENTRY, generateSetContext(1));
			expect(ENTRY[EXPIRES_AT_SYM]).to.not.be.eq(undefined);

			policy.onDelete('a', ENTRY);
			expect(ENTRY[EXPIRES_AT_SYM]).to.be.eq(undefined);

			expect(policy.onHit('a', ENTRY)).to.be.eq(EntryValidity.VALID); // does so because EXPIRES_AT has been deleted
		});

		it('does nothing on clear', () => {
			const policy = new ReactiveExpirationPolicy<string, any>();
			policy.onClear();
		});
	});
});

import { describe, it } from 'mocha';
import colors from 'colors';
import { array, chrono } from '@thermopylae/lib.utils';
import { expect } from '@thermopylae/lib.unit-test';
import { ReactiveExpirationPolicy } from '../../../lib/policies/expiration/reactive';
import { EntryValidity } from '../../../lib/contracts/cache-replacement-policy';
import { EXPIRES_AT_SYM, INFINITE_EXPIRATION } from '../../../lib/constants';
import { ExpirableCacheEntry } from '../../../lib/policies/expiration/abstract';

function generateEntry(): ExpirableCacheEntry<string, any> {
	return {
		key: '',
		value: array.randomElement(generateEntry.VALUES)
	};
}
generateEntry.VALUES = [undefined, null, false, 0, '', {}, []];

describe(`${colors.magenta(ReactiveExpirationPolicy.name)} spec`, () => {
	describe(`${ReactiveExpirationPolicy.prototype.onSet.name.magenta} spec`, () => {
		it('should set entry entry expiration and evict it if expired on hit', (done) => {
			const policy = new ReactiveExpirationPolicy<string, any>();
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedKey, evictedEntry) => {
				EVICTED_KEYS.push(evictedKey);

				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntry<string, number>);
				expect((evictedEntry as ExpirableCacheEntry<string, number>)[EXPIRES_AT_SYM]).to.be.eq(undefined);
			});

			const KEY = 'a';
			const ENTRY = generateEntry();
			const TTL = 2; // we use 2 seconds, because of the 'time windows', i.e. when we set item on lasts milliseconds of current second
			policy.onSet(KEY, ENTRY, { expiresAfter: TTL });

			expect(policy.onHit(KEY, ENTRY)).to.be.eq(EntryValidity.VALID);
			expect(EVICTED_KEYS).to.be.ofSize(0); // entry is still valid

			setTimeout(() => {
				try {
					expect(policy.onHit(KEY, ENTRY)).to.be.eq(EntryValidity.VALID, `Expected ${KEY} to be valid.`);
					expect(EVICTED_KEYS).to.be.ofSize(0);
				} catch (e) {
					clearTimeout(timeoutExpired);
					done(e);
				}
			}, chrono.secondsToMilliseconds(TTL / 2) + 120);

			const timeoutExpired = setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(0); // entry is still valid
					expect(policy.onHit(KEY, ENTRY)).to.be.eq(EntryValidity.NOT_VALID, `Expected ${KEY} to not be valid.`);
					expect(EVICTED_KEYS).to.be.ofSize(1); // entry was evicted
					expect(ENTRY[EXPIRES_AT_SYM]).to.be.eq(undefined); // and metadata was removed
					done();
				} catch (e) {
					done(e);
				}
			}, chrono.secondsToMilliseconds(TTL) + 120);
		}).timeout(2500);

		it('should evict items even when have negative ttl, but increased expires from', (done) => {
			const policy = new ReactiveExpirationPolicy<string, any>();
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedKey, evictedEntry) => {
				EVICTED_KEYS.push(evictedKey);

				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntry<string, number>);
				expect((evictedEntry as ExpirableCacheEntry<string, number>)[EXPIRES_AT_SYM]).to.be.eq(undefined);
			});

			const KEY = 'a';
			const ENTRY = generateEntry();
			const TTL = -1;
			const EXPIRES_FROM = chrono.unixTime() + 2;
			policy.onSet(KEY, ENTRY, { expiresAfter: TTL, expiresFrom: EXPIRES_FROM });

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
			policy.setDeleter((evictedKey, evictedEntry) => {
				EVICTED_KEYS.push(evictedKey);

				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntry<string, number>);
				expect((evictedEntry as ExpirableCacheEntry<string, number>)[EXPIRES_AT_SYM]).to.be.eq(undefined);
			});

			const ENTRIES = new Map<string, [ExpirableCacheEntry<string, any>, number | null | undefined]>([
				['a', [generateEntry(), INFINITE_EXPIRATION]],
				['b', [generateEntry(), null]],
				['c', [generateEntry(), undefined]]
			]);

			for (const [key, [entry, ttl]] of ENTRIES) {
				policy.onSet(key, entry, { expiresAfter: ttl! });
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
			policy.setDeleter((evictedKey, evictedEntry) => {
				EVICTED_KEYS.push(evictedKey);

				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntry<string, number>);
				expect((evictedEntry as ExpirableCacheEntry<string, number>)[EXPIRES_AT_SYM]).to.be.eq(undefined);
			});

			const ENTRY = generateEntry();
			policy.onSet('a', ENTRY, { expiresAfter: 2 }); // original
			policy.onSet('a', ENTRY, { expiresAfter: 3 }); // increase
			policy.onSet('a', ENTRY, { expiresAfter: 1 }); // decrease

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
			policy.setDeleter((evictedKey, evictedEntry) => {
				EVICTED_KEYS.push(evictedKey);

				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntry<string, number>);
				expect((evictedEntry as ExpirableCacheEntry<string, number>)[EXPIRES_AT_SYM]).to.be.eq(undefined);
			});

			const ENTRY = generateEntry();
			const now = chrono.unixTime();
			policy.onUpdate('a', ENTRY, { expiresAfter: 1 });
			expect(ENTRY[EXPIRES_AT_SYM]).to.not.be.greaterThan(now + 1 + 1); // 1 sec for epsilon in case `now` will differ

			policy.onUpdate('a', ENTRY, { expiresAfter: INFINITE_EXPIRATION });
			expect(ENTRY[EXPIRES_AT_SYM]).to.be.eq(undefined);

			policy.onUpdate('a', ENTRY, { expiresAfter: -1, expiresFrom: now + 1 });
			expect(ENTRY[EXPIRES_AT_SYM]).to.not.be.greaterThan(now + 1); // 1 sec for epsilon in case `now` will differ

			expect(policy.onHit('a', ENTRY)).to.be.eq(EntryValidity.NOT_VALID);
			expect(ENTRY[EXPIRES_AT_SYM]).to.be.eq(undefined);
			expect(EVICTED_KEYS).to.be.ofSize(1);
			expect(EVICTED_KEYS).to.be.containingAllOf(['a']);
		});

		it('should do nothing when options or ttl is not given', (done) => {
			const policy = new ReactiveExpirationPolicy<string, any>();
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedKey, evictedEntry) => {
				EVICTED_KEYS.push(evictedKey);

				policy.onDelete(evictedKey, evictedEntry as ExpirableCacheEntry<string, number>);
				expect((evictedEntry as ExpirableCacheEntry<string, number>)[EXPIRES_AT_SYM]).to.be.eq(undefined);
			});

			const ENTRY = generateEntry();
			policy.onUpdate('a', ENTRY, { expiresAfter: 1 });
			policy.onUpdate('a', ENTRY); // has no effect
			policy.onUpdate('a', ENTRY, { expiresAfter: undefined }); // has no effect
			policy.onUpdate('a', ENTRY, { expiresAfter: null! }); // has no effect

			setTimeout(() => {
				try {
					expect(policy.onHit('a', ENTRY)).to.be.eq(EntryValidity.NOT_VALID);
					expect(EVICTED_KEYS).to.be.containingAllOf(['a']);
					done();
				} catch (e) {
					done(e);
				}
			}, 1100);
		});
	});

	describe(`${ReactiveExpirationPolicy.prototype.onDelete.name.magenta} spec`, () => {
		it('removes metadata when entry is deleted explicitly', () => {
			const policy = new ReactiveExpirationPolicy<string, any>();

			const ENTRY = generateEntry();
			policy.onSet('a', ENTRY, { expiresAfter: 1 });
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

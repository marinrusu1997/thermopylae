import { buildPromiseHolder } from '@thermopylae/lib.async';
import { array, chrono } from '@thermopylae/lib.utils';
import colors from 'colors';
import { describe, expect, it } from 'vitest';
import { EXPIRES_AT_SYM, INFINITE_EXPIRATION } from '../../../lib/constants.js';
import { EntryValidity, ReactiveExpirationPolicy } from '../../../lib/index.js';
import type { ExpirableCacheEntry } from '../../../lib/policies/expiration/abstract.js';

function generateEntry(key: string): ExpirableCacheEntry<string, any> {
	return {
		key,
		value: array.randomElement(generateEntry.VALUES)
	};
}
generateEntry.VALUES = [undefined, null, false, 0, '', {}, []];

describe(`${colors.magenta(ReactiveExpirationPolicy.name)} spec`, () => {
	describe(`${ReactiveExpirationPolicy.prototype.onSet.name.magenta} spec`, () => {
		it('should set entry entry expiration and evict it if expired on hit', { timeout: 2500 }, async () => {
			const policy = new ReactiveExpirationPolicy<string, any>();
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);

				policy.onDelete(evictedEntry as ExpirableCacheEntry<string, number>);
				expect((evictedEntry as ExpirableCacheEntry<string, number>)[EXPIRES_AT_SYM]).to.be.eq(undefined);
			});

			const KEY = 'a';
			const ENTRY = generateEntry(KEY);
			const TTL = 2; // we use 2 seconds, because of the 'time windows', i.e. when we set item on lasts milliseconds of current second
			policy.onSet(ENTRY, { expiresAfter: TTL });

			expect(policy.onHit(ENTRY)).to.be.eq(EntryValidity.VALID);
			expect(EVICTED_KEYS).to.have.length(0); // entry is still valid

			const deferred = buildPromiseHolder<void>();
			setTimeout(
				() => {
					try {
						expect(policy.onHit(ENTRY)).to.be.eq(EntryValidity.VALID, `Expected ${KEY} to be valid.`);
						expect(EVICTED_KEYS).to.have.length(0);
					} catch (e) {
						clearTimeout(timeoutExpired);
						deferred.reject(e);
					}
				},
				chrono.secondsToMilliseconds(TTL / 2) + 120
			);

			const timeoutExpired = setTimeout(
				() => {
					try {
						expect(EVICTED_KEYS).to.have.length(0); // entry is still valid
						expect(policy.onHit(ENTRY)).to.be.eq(EntryValidity.NOT_VALID, `Expected ${KEY} to not be valid.`);
						expect(EVICTED_KEYS).to.have.length(1); // entry was evicted
						expect(ENTRY[EXPIRES_AT_SYM]).to.be.eq(undefined); // and metadata was removed
						deferred.resolve();
					} catch (e) {
						deferred.reject(e);
					}
				},
				chrono.secondsToMilliseconds(TTL) + 120
			);

			await deferred.promise;
		});

		it('should evict items even when have negative ttl, but increased expires from', async () => {
			const policy = new ReactiveExpirationPolicy<string, any>();
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);

				policy.onDelete(evictedEntry as ExpirableCacheEntry<string, number>);
				expect((evictedEntry as ExpirableCacheEntry<string, number>)[EXPIRES_AT_SYM]).to.be.eq(undefined);
			});

			const ENTRY = generateEntry('key');
			const TTL = -1;
			const EXPIRES_FROM = chrono.unixTime() + 2;
			policy.onSet(ENTRY, { expiresAfter: TTL, expiresFrom: EXPIRES_FROM });

			expect(policy.onHit(ENTRY)).to.be.eq(EntryValidity.VALID);
			expect(EVICTED_KEYS).to.have.length(0); // entry is still valid

			const deferred = buildPromiseHolder<void>();
			setTimeout(
				() => {
					try {
						expect(EVICTED_KEYS).to.have.length(0); // entry is still valid
						expect(policy.onHit(ENTRY)).to.be.eq(EntryValidity.NOT_VALID);
						expect(EVICTED_KEYS).toStrictEqual(['key']); // entry was evicted
						expect(ENTRY[EXPIRES_AT_SYM]).to.be.eq(undefined); // and metadata was removed
						deferred.resolve();
					} catch (e) {
						deferred.reject(e);
					}
				},
				chrono.secondsToMilliseconds(Math.abs(TTL)) + 20
			);

			await deferred.promise;
		});

		it("should not set entry expiration and don't evict it if has infinite or no ttl", async () => {
			const policy = new ReactiveExpirationPolicy<string, any>();
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);

				policy.onDelete(evictedEntry as ExpirableCacheEntry<string, number>);
				expect((evictedEntry as ExpirableCacheEntry<string, number>)[EXPIRES_AT_SYM]).to.be.eq(undefined);
			});

			const ENTRIES = new Map<string, [ExpirableCacheEntry<string, any>, number | null | undefined]>([
				['a', [generateEntry('a'), INFINITE_EXPIRATION]],
				['b', [generateEntry('b'), null]],
				['c', [generateEntry('c'), undefined]]
			]);

			for (const [entry, ttl] of ENTRIES.values()) {
				policy.onSet(entry, { expiresAfter: ttl! });
			}

			for (const [entry] of ENTRIES.values()) {
				expect(policy.onHit(entry)).to.be.eq(EntryValidity.VALID);
				expect(EVICTED_KEYS).to.have.length(0);
			}

			const deferred = buildPromiseHolder<void>();
			setTimeout(() => {
				try {
					for (const [entry] of ENTRIES.values()) {
						expect(policy.onHit(entry)).to.be.eq(EntryValidity.VALID);
						expect(EVICTED_KEYS).to.have.length(0);
					}

					deferred.resolve();
				} catch (e) {
					deferred.reject(e);
				}
			}, 100);

			await deferred.promise;
		});
	});

	describe(`${ReactiveExpirationPolicy.prototype.onUpdate.name.magenta} spec`, () => {
		it('should update timeout when it increases/decreases', async () => {
			const policy = new ReactiveExpirationPolicy<string, any>();
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);

				policy.onDelete(evictedEntry as ExpirableCacheEntry<string, number>);
				expect((evictedEntry as ExpirableCacheEntry<string, number>)[EXPIRES_AT_SYM]).to.be.eq(undefined);
			});

			const ENTRY = generateEntry('a');
			policy.onSet(ENTRY, { expiresAfter: 2 }); // original
			policy.onSet(ENTRY, { expiresAfter: 3 }); // increase
			policy.onSet(ENTRY, { expiresAfter: 1 }); // decrease

			expect(policy.onHit(ENTRY)).to.be.eq(EntryValidity.VALID);

			const deferred = buildPromiseHolder<void>();
			setTimeout(() => {
				try {
					expect(policy.onHit(ENTRY)).to.be.eq(EntryValidity.NOT_VALID);
					expect(EVICTED_KEYS).toStrictEqual(['a']);
					deferred.resolve();
				} catch (e) {
					deferred.reject(e);
				}
			}, 1050);

			await deferred.promise;
		});

		it('should update timeout when it is set/unset', () => {
			const policy = new ReactiveExpirationPolicy<string, any>();
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);

				policy.onDelete(evictedEntry as ExpirableCacheEntry<string, number>);
				expect((evictedEntry as ExpirableCacheEntry<string, number>)[EXPIRES_AT_SYM]).to.be.eq(undefined);
			});

			const ENTRY = generateEntry('a');
			const now = chrono.unixTime();
			policy.onUpdate(ENTRY, { expiresAfter: 1 });
			expect(ENTRY[EXPIRES_AT_SYM]).to.not.be.greaterThan(now + 1 + 1); // 1 sec for epsilon in case `now` will differ

			policy.onUpdate(ENTRY, { expiresAfter: INFINITE_EXPIRATION });
			expect(ENTRY[EXPIRES_AT_SYM]).to.be.eq(undefined);

			policy.onUpdate(ENTRY, { expiresAfter: -1, expiresFrom: now + 1 });
			expect(ENTRY[EXPIRES_AT_SYM]).to.not.be.greaterThan(now + 1); // 1 sec for epsilon in case `now` will differ

			expect(policy.onHit(ENTRY)).to.be.eq(EntryValidity.NOT_VALID);
			expect(ENTRY[EXPIRES_AT_SYM]).to.be.eq(undefined);
			expect(EVICTED_KEYS).toStrictEqual(['a']);
		});

		it('should do nothing when options or ttl is not given', async () => {
			const policy = new ReactiveExpirationPolicy<string, any>();
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);

				policy.onDelete(evictedEntry as ExpirableCacheEntry<string, number>);
				expect((evictedEntry as ExpirableCacheEntry<string, number>)[EXPIRES_AT_SYM]).to.be.eq(undefined);
			});

			const ENTRY = generateEntry('a');
			policy.onUpdate(ENTRY, { expiresAfter: 1 });
			policy.onUpdate(ENTRY); // has no effect
			policy.onUpdate(ENTRY, { expiresAfter: undefined }); // has no effect
			policy.onUpdate(ENTRY, { expiresAfter: null! }); // has no effect

			const deferred = buildPromiseHolder<void>();
			setTimeout(() => {
				try {
					expect(policy.onHit(ENTRY)).to.be.eq(EntryValidity.NOT_VALID);
					expect(EVICTED_KEYS).toStrictEqual(['a']);
					deferred.resolve();
				} catch (e) {
					deferred.reject(e);
				}
			}, 1100);

			await deferred.promise;
		});
	});

	describe(`${ReactiveExpirationPolicy.prototype.onDelete.name.magenta} spec`, () => {
		it('removes metadata when entry is deleted explicitly', () => {
			const policy = new ReactiveExpirationPolicy<string, any>();

			const ENTRY = generateEntry('a');
			policy.onSet(ENTRY, { expiresAfter: 1 });
			expect(ENTRY[EXPIRES_AT_SYM]).to.not.be.eq(undefined);

			policy.onDelete(ENTRY);
			expect(ENTRY[EXPIRES_AT_SYM]).to.be.eq(undefined);

			expect(policy.onHit(ENTRY)).to.be.eq(EntryValidity.VALID); // does so because EXPIRES_AT has been deleted
		});

		it('does nothing on clear', () => {
			const policy = new ReactiveExpirationPolicy<string, any>();
			policy.onClear();
		});
	});
});

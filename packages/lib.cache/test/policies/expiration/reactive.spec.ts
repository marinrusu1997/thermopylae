import { buildPromiseHolder } from '@thermopylae/lib.async';
import { chrono, type types } from '@thermopylae/lib.utils';
import colors from 'colors';
import { convert } from 'convert';
import randomItem from 'random-item';
import { describe, expect, it } from 'vitest';
import { EXPIRES_AT_SYM, INFINITE_EXPIRATION } from '../../../lib/constants.js';
import { EntryValidity, ReactiveExpirationPolicy } from '../../../lib/index.js';
import type { ExpirableCacheEntry } from '../../../lib/policies/expiration/abstract.js';

function generateEntry<K, V extends (typeof generateEntry.VALUES)[0]>(key: K): ExpirableCacheEntry<K, V> {
	return {
		key,
		value: randomItem(generateEntry.VALUES) as types.Any,
		[EXPIRES_AT_SYM]: undefined
	};
}
generateEntry.VALUES = [undefined, null, false as boolean, 0 as number, '' as string, {}, []] as const;

describe(`${colors.magenta(ReactiveExpirationPolicy.name)} spec`, () => {
	describe(`${ReactiveExpirationPolicy.prototype.onSet.name.magenta} spec`, () => {
		it('should set entry entry expiration and evict it if expired on hit', { timeout: 2500 }, async () => {
			const policy = new ReactiveExpirationPolicy<string, unknown>();
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);

				policy.onDelete(evictedEntry as ExpirableCacheEntry<string, number>);
				expect((evictedEntry as ExpirableCacheEntry<string, number>)[EXPIRES_AT_SYM]).toBeUndefined();
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
					} catch (error) {
						clearTimeout(timeoutExpired);
						deferred.reject(error);
					}
				},
				convert(Math.trunc(TTL / 2), 's').to('ms') + 100
			);

			const timeoutExpired = setTimeout(
				() => {
					try {
						expect(EVICTED_KEYS).to.have.length(0); // entry is still valid
						expect(policy.onHit(ENTRY)).to.be.eq(EntryValidity.NOT_VALID, `Expected ${KEY} to not be valid.`);
						expect(EVICTED_KEYS).to.have.length(1); // entry was evicted
						expect(ENTRY[EXPIRES_AT_SYM]).toBeUndefined(); // and metadata was removed
						deferred.resolve();
					} catch (error) {
						deferred.reject(error);
					}
				},
				convert(TTL, 's').to('ms') + 200
			);

			await deferred.promise;
		});

		it('should evict items even when have negative ttl, but increased expires from', async () => {
			const policy = new ReactiveExpirationPolicy<string, unknown>();
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);

				policy.onDelete(evictedEntry as ExpirableCacheEntry<string, number>);
				expect((evictedEntry as ExpirableCacheEntry<string, number>)[EXPIRES_AT_SYM]).toBeUndefined();
			});

			const ENTRY = generateEntry('key');
			const TTL = -1;
			const EXPIRES_FROM = chrono.unix() + 2;
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
						expect(ENTRY[EXPIRES_AT_SYM]).toBeUndefined(); // and metadata was removed
						deferred.resolve();
					} catch (error) {
						deferred.reject(error);
					}
				},
				convert(Math.abs(TTL), 's').to('ms') + 20
			);

			await deferred.promise;
		});

		it("should not set entry expiration and don't evict it if has infinite or no ttl", async () => {
			const policy = new ReactiveExpirationPolicy<string, unknown>();
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);

				policy.onDelete(evictedEntry as ExpirableCacheEntry<string, number>);
				expect((evictedEntry as ExpirableCacheEntry<string, number>)[EXPIRES_AT_SYM]).toBeUndefined();
			});

			const ENTRIES = new Map<string, [ExpirableCacheEntry<string, unknown>, number | null | undefined]>([
				['a', [generateEntry('a'), INFINITE_EXPIRATION]],
				['b', [generateEntry('b'), null]],
				['c', [generateEntry('c'), undefined]]
			]);

			for (const [entry, ttl] of ENTRIES.values()) {
				policy.onSet(entry, { expiresAfter: ttl as number });
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
				} catch (error) {
					deferred.reject(error);
				}
			}, 100);

			await deferred.promise;
		});
	});

	describe(`${ReactiveExpirationPolicy.prototype.onUpdate.name.magenta} spec`, () => {
		it('should update timeout when it increases/decreases', async () => {
			const policy = new ReactiveExpirationPolicy<string, unknown>();
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);

				policy.onDelete(evictedEntry as ExpirableCacheEntry<string, number>);
				expect((evictedEntry as ExpirableCacheEntry<string, number>)[EXPIRES_AT_SYM]).toBeUndefined();
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
				} catch (error) {
					deferred.reject(error);
				}
			}, 1050);

			await deferred.promise;
		});

		it('should update timeout when it is set/unset', () => {
			const policy = new ReactiveExpirationPolicy<string, unknown>();
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);

				policy.onDelete(evictedEntry as ExpirableCacheEntry<string, number>);
				expect((evictedEntry as ExpirableCacheEntry<string, number>)[EXPIRES_AT_SYM]).toBeUndefined();
			});

			const ENTRY = generateEntry('a');
			const now = chrono.unix();
			policy.onUpdate(ENTRY, { expiresAfter: 1 });
			expect(ENTRY[EXPIRES_AT_SYM]).to.not.be.greaterThan(now + 1 + 1); // 1 sec for epsilon in case `now` will differ

			policy.onUpdate(ENTRY, { expiresAfter: INFINITE_EXPIRATION });
			expect(ENTRY[EXPIRES_AT_SYM]).toBeUndefined();

			policy.onUpdate(ENTRY, { expiresAfter: -1, expiresFrom: now + 1 });
			expect(ENTRY[EXPIRES_AT_SYM]).to.not.be.greaterThan(now + 1); // 1 sec for epsilon in case `now` will differ

			expect(policy.onHit(ENTRY)).to.be.eq(EntryValidity.NOT_VALID);
			expect(ENTRY[EXPIRES_AT_SYM]).toBeUndefined();
			expect(EVICTED_KEYS).toStrictEqual(['a']);
		});

		it('should do nothing when options or ttl is not given', async () => {
			const policy = new ReactiveExpirationPolicy<string, unknown>();
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((evictedEntry) => {
				EVICTED_KEYS.push(evictedEntry.key);

				policy.onDelete(evictedEntry as ExpirableCacheEntry<string, number>);
				expect((evictedEntry as ExpirableCacheEntry<string, number>)[EXPIRES_AT_SYM]).toBeUndefined();
			});

			const ENTRY = generateEntry('a');
			policy.onUpdate(ENTRY, { expiresAfter: 1 });
			policy.onUpdate(ENTRY); // has no effect
			policy.onUpdate(ENTRY, { expiresAfter: undefined }); // has no effect
			policy.onUpdate(ENTRY, { expiresAfter: null as types.Any }); // has no effect

			const deferred = buildPromiseHolder<void>();
			setTimeout(() => {
				try {
					expect(policy.onHit(ENTRY)).to.be.eq(EntryValidity.NOT_VALID);
					expect(EVICTED_KEYS).toStrictEqual(['a']);
					deferred.resolve();
				} catch (error) {
					deferred.reject(error);
				}
			}, 1100);

			await deferred.promise;
		});
	});

	describe(`${ReactiveExpirationPolicy.prototype.onDelete.name.magenta} spec`, () => {
		it('removes metadata when entry is deleted explicitly', () => {
			const policy = new ReactiveExpirationPolicy<string, unknown>();

			const ENTRY = generateEntry('a');
			policy.onSet(ENTRY, { expiresAfter: 1 });
			expect(ENTRY[EXPIRES_AT_SYM]).toBeDefined();

			policy.onDelete(ENTRY);
			expect(ENTRY[EXPIRES_AT_SYM]).toBeUndefined();

			policy.onClear(); // does nothing on clear
			expect(policy.onHit(ENTRY)).to.be.eq(EntryValidity.VALID); // does so because EXPIRES_AT has been deleted
		});
	});
});

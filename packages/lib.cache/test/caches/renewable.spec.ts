import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import colors from 'colors';
import { chrono } from '@thermopylae/lib.utils';
import { KeyRetriever, PromiseHolder, RenewableCache } from '../../lib/caches/renewable';
import { EntryPoolCacheBackend } from '../../lib/backend/entry-pool';
import { PolicyBasedCache } from '../../lib/caches/policy-based';
import { CacheEvent } from '../../lib/contracts/cache-event-emitter';

describe(`${colors.magenta(RenewableCache.name)} spec`, () => {
	describe(`${RenewableCache.prototype.get.name.magenta} spec`, () => {
		it('prevents multiple calls of the retriever with the same key', async () => {
			let retrieverCalls = 0;
			const keyRetriever: KeyRetriever<string, string> = (key) => {
				retrieverCalls += 1;
				return new Promise<string>((resolve) => {
					setTimeout(() => resolve(key), 20);
				});
			};

			const backend = new EntryPoolCacheBackend<string, PromiseHolder<string>>(10);
			const cache = new PolicyBasedCache<string, PromiseHolder<string>>(backend);
			const renewableCache = new RenewableCache<string, string>({
				cache,
				keyRetriever
			});

			const results = await Promise.all([
				renewableCache.get('a'),
				renewableCache.get('a'),
				renewableCache.get('a'),
				renewableCache.get('b'),
				renewableCache.get('b')
			]);
			expect(results).to.be.equalTo(['a', 'a', 'a', 'b', 'b']);

			expect(retrieverCalls).to.be.eq(2);
			expect(renewableCache.size).to.be.eq(2);

			await expect(renewableCache.get('a')).to.eventually.be.eq('a');
			await expect(renewableCache.get('b')).to.eventually.be.eq('b');
			expect(retrieverCalls).to.be.eq(2); // retriever not called cuz we have it in cache

			expect(renewableCache.has('a')).to.be.eq(true);
		});

		it('notifies all callers that retriever threw an exception', async () => {
			const errors = new Array<Error>();
			const keyRetriever: KeyRetriever<string, string> = (key) => {
				return new Promise<string>((_, reject) => {
					setTimeout(() => {
						const error = new Error(key);
						errors.push(error);
						reject(error);
					}, 20);
				});
			};

			const backend = new EntryPoolCacheBackend<string, PromiseHolder<string>>(10);
			const cache = new PolicyBasedCache<string, PromiseHolder<string>>(backend);
			const renewableCache = new RenewableCache<string, string>({ cache, keyRetriever });

			const results = await Promise.allSettled([
				renewableCache.get('a'),
				renewableCache.get('a'),
				renewableCache.get('a'),
				renewableCache.get('b'),
				renewableCache.get('b')
			]);

			expect(renewableCache.size).to.be.eq(0);
			expect(errors).to.be.ofSize(2); // retriever called 2 times
			expect(results).to.be.ofSize(5);
			for (let i = 0; i < 3; i++) {
				expect(results[i].status).to.be.eq('rejected');
				// @ts-ignore
				expect(results[i].reason).to.be.deep.eq(errors[0]);
			}
			for (let i = 3; i < 5; i++) {
				expect(results[i].status).to.be.eq('rejected');
				// @ts-ignore
				expect(results[i].reason).to.be.deep.eq(errors[1]);
			}

			await expect(renewableCache.get('a')).to.eventually.be.rejectedWith('a');
			expect(errors).to.be.ofSize(3);
			expect(errors[2].message).to.be.eq('a');
			expect(renewableCache.size).to.be.eq(0);

			expect(renewableCache.has('a')).to.be.eq(false);
			expect(renewableCache.has('b')).to.be.eq(false);
		});

		it('handles scenario when promise holder was removed from cache before retriever returned entry', async () => {
			const requestedKeys = new Array<string>();
			const keyRetriever: KeyRetriever<string, string> = (key) => {
				return new Promise<string>((resolve) => {
					setTimeout(() => {
						requestedKeys.push(key);
						resolve(key);
					}, 100);
				});
			};

			const backend = new EntryPoolCacheBackend<string, PromiseHolder<string>>(10);
			const cache = new PolicyBasedCache<string, PromiseHolder<string>>(backend);
			const renewableCache = new RenewableCache<string, string>({ cache, keyRetriever });

			const requests = Promise.all([
				renewableCache.get('a'),
				renewableCache.get('a'),
				renewableCache.get('a'),
				renewableCache.get('b'),
				renewableCache.get('b')
			]);
			expect(renewableCache.size).to.be.eq(2);
			renewableCache.del('a');
			renewableCache.del('b');
			expect(renewableCache.size).to.be.eq(0);

			const results = await requests;
			expect(results).to.be.equalTo(['a', 'a', 'a', 'b', 'b']);
			expect(requestedKeys).to.be.equalTo(['a', 'b']);
			expect(renewableCache.size).to.be.eq(0);

			expect(renewableCache.has('a')).to.be.eq(false);

			const firstReq = await chrono.executionTimeAsync(renewableCache.get, renewableCache, 'a');
			expect(firstReq.result).to.be.eq('a');
			expect(firstReq.time.milliseconds).to.be.gte(100); // retriever run
			expect(requestedKeys).to.be.equalTo(['a', 'b', 'a']);

			const secondReq = await chrono.executionTimeAsync(renewableCache.get, renewableCache, 'a');
			expect(secondReq.result).to.be.eq('a');
			expect(secondReq.time.milliseconds).to.be.lessThan(50); // no retriever run
			expect(requestedKeys).to.be.equalTo(['a', 'b', 'a']);
		});

		it('removes promise holder from cache if retriever found nothing', async () => {
			const requestedKeys = new Array<string>();
			const keyRetriever: KeyRetriever<string, string> = (key) => {
				return new Promise<string>((resolve) => {
					setTimeout(() => {
						requestedKeys.push(key);
						resolve(undefined);
					}, 20);
				});
			};

			const backend = new EntryPoolCacheBackend<string, PromiseHolder<string>>(10);
			const cache = new PolicyBasedCache<string, PromiseHolder<string>>(backend);
			const renewableCache = new RenewableCache<string, string>({ cache, keyRetriever });

			const results = await Promise.all([
				renewableCache.get('a'),
				renewableCache.get('a'),
				renewableCache.get('a'),
				renewableCache.get('b'),
				renewableCache.get('b')
			]);
			expect(results).to.be.equalTo([undefined, undefined, undefined, undefined, undefined]);
			expect(requestedKeys).to.be.equalTo(['a', 'b']);
			expect(renewableCache.size).to.be.eq(0);

			expect(renewableCache.has('a')).to.be.eq(false);
			expect(renewableCache.has('b')).to.be.eq(false);
		});
	});

	describe(`${RenewableCache.prototype.set.name.magenta} spec`, () => {
		it('inserts entries in the cache', async () => {
			const requestedKeys = new Array<string>();
			const keyRetriever: KeyRetriever<string, string> = (key) => {
				return new Promise<string>((resolve) => {
					setTimeout(() => {
						requestedKeys.push(key);
						resolve(key);
					}, 20);
				});
			};

			const backend = new EntryPoolCacheBackend<string, PromiseHolder<string>>(10);
			const cache = new PolicyBasedCache<string, PromiseHolder<string>>(backend);
			const renewableCache = new RenewableCache<string, string>({ cache, keyRetriever });

			renewableCache.set('a', 'a');
			expect(Array.from(renewableCache.keys())).to.be.equalTo(['a']);

			await expect(renewableCache.get('a')).to.eventually.be.eq('a');
			expect(requestedKeys).to.be.ofSize(0);
			expect(renewableCache.size).to.be.eq(1);
		});

		it('updates entries in the cache and might discard value returned by retriever', async () => {
			const requestedKeys = new Array<string>();
			const keyRetriever: KeyRetriever<string, string> = (key) => {
				return new Promise<string>((resolve) => {
					setTimeout(() => {
						requestedKeys.push(key);
						resolve(key);
					}, 100);
				});
			};

			const backend = new EntryPoolCacheBackend<string, PromiseHolder<string>>(10);
			const cache = new PolicyBasedCache<string, PromiseHolder<string>>(backend);
			const renewableCache = new RenewableCache<string, string>({ cache, keyRetriever });

			renewableCache.set('a', 'a');
			await expect(renewableCache.get('a')).to.eventually.be.eq('a');
			expect(requestedKeys).to.be.ofSize(0);

			renewableCache.set('a', 'a1');
			await expect(renewableCache.get('a')).to.eventually.be.eq('a1');
			expect(requestedKeys).to.be.ofSize(0);

			renewableCache.clear();
			expect(renewableCache.size).to.be.eq(0);

			const requests = Promise.all([renewableCache.get('a'), renewableCache.get('a'), renewableCache.get('b'), renewableCache.get('b')]);
			renewableCache.set('a', 'a1');
			renewableCache.set('b', 'b1');

			const responses = await requests;
			expect(responses).to.be.equalTo(['a', 'a', 'b', 'b']);
			expect(requestedKeys).to.be.equalTo(['a', 'b']);

			await expect(renewableCache.get('a')).to.eventually.be.eq('a1');
			await expect(renewableCache.get('b')).to.eventually.be.eq('b1');
		});
	});

	describe(`${'events'.magenta} spec`, () => {
		it('should emit events', async () => {
			const keyRetriever: KeyRetriever<string, string> = (key) => {
				return new Promise<string>((resolve) => {
					setTimeout(() => resolve(key), 20);
				});
			};

			const backend = new EntryPoolCacheBackend<string, PromiseHolder<string>>(10);
			const cache = new PolicyBasedCache<string, PromiseHolder<string>>(backend);
			const renewableCache = new RenewableCache<string, string>({ cache, keyRetriever });

			const events = new Map<CacheEvent, Array<string>>();

			renewableCache.events.eventMask = CacheEvent.INSERT | CacheEvent.UPDATE | CacheEvent.DELETE | CacheEvent.FLUSH;
			renewableCache.events.on(CacheEvent.INSERT, async (key, promiseHolder) => {
				events.set(CacheEvent.INSERT, [key, await promiseHolder.promise]);
			});
			renewableCache.events.on(CacheEvent.UPDATE, (key) => {
				events.set(CacheEvent.UPDATE, [key]);
			});
			renewableCache.events.on(CacheEvent.DELETE, (key) => {
				events.set(CacheEvent.DELETE, [key]);
			});
			renewableCache.events.on(CacheEvent.FLUSH, () => {
				events.set(CacheEvent.FLUSH, []);
			});

			await renewableCache.get('a');
			expect(events.get(CacheEvent.INSERT)).to.be.equalTo(['a', 'a']);

			renewableCache.set('a', 'a1');
			expect(events.get(CacheEvent.UPDATE)).to.be.equalTo(['a']);

			renewableCache.del('a');
			expect(events.get(CacheEvent.DELETE)).to.be.equalTo(['a']);

			renewableCache.clear();
			expect(events.get(CacheEvent.FLUSH)).to.be.ofSize(0);
		});
	});
});

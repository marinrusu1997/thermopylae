import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import { PolicyBasedCache } from '../../lib/caches/policy-based';
import { EsMapCacheBackend } from '../../lib/backend/es-map';
import { PolicyMock } from './mocks/policy';
import { EntryValidity } from '../../lib/contracts/cache-replacement-policy';
import { CacheEvent } from '../../lib/contracts/cache-event-emitter';

describe(`${PolicyBasedCache.name.magenta} spec`, () => {
	describe(`${PolicyBasedCache.prototype.get.name.magenta} spec`, () => {
		it('returns undefined if item is not present in cache', () => {
			const backend = new EsMapCacheBackend<string, any>();
			const cache = new PolicyBasedCache<string, any, any>(backend);
			expect(cache.get('key')).to.be.eq(undefined);
		});

		it('returns undefined if item was present in cache, but some of the policies decided that it needs to be evicted (e.g. expired)', () => {
			const backend = new EsMapCacheBackend<string, any>();
			const policy = new PolicyMock<string, any, any>();
			const cache = new PolicyBasedCache<string, any, any>(backend, [policy]);

			policy.methodBehaviours.get('onGet')!.returnValue = EntryValidity.NOT_VALID;
			backend.set('key', 'value');

			expect(cache.get('key')).to.be.eq(undefined);
			expect(backend.get('key')).to.be.eq(undefined); // it also evicted from backend...
			expect(policy.methodBehaviours.get('onDelete')!.calls).to.be.eq(1); // ... via onDelete hook
		});

		it('returns value if key was present in cache (no policies registered)', () => {
			const backend = new EsMapCacheBackend<string, any>();
			const cache = new PolicyBasedCache<string, any, any>(backend);

			backend.set('key', 'value');
			expect(cache.get('key')).to.be.eq('value');
		});

		it('returns value if key was present in cache and policies decided not to evict item', () => {
			const backend = new EsMapCacheBackend<string, any>();
			const policy = new PolicyMock<string, any, any>();
			const cache = new PolicyBasedCache<string, any, any>(backend, [policy]);

			policy.methodBehaviours.get('onGet')!.returnValue = EntryValidity.VALID;
			backend.set('key', 'value');

			expect(cache.get('key')).to.be.eq('value');
			expect(policy.methodBehaviours.get('onGet')!.calls).to.be.eq(1);
			expect(policy.methodBehaviours.get('onGet')!.arguments![0]).to.be.eq('key');
		});
	});

	describe(`${PolicyBasedCache.prototype.has.name.magenta} spec`, () => {
		it('returns whether key is present in the cache without calling any policies hooks', () => {
			const backend = new EsMapCacheBackend<string, any>();
			const policy = new PolicyMock<string, any, any>();
			const cache = new PolicyBasedCache<string, any, any>(backend, [policy]);

			backend.set('key', 'value');

			expect(cache.has('key')).to.be.eq(true);
			expect(policy.methodBehaviours.get('onGet')!.calls).to.be.eq(0);
		});
	});

	describe(`${PolicyBasedCache.prototype.set.name.magenta} spec`, () => {
		it('sets new key-value pair in the cache and emits event', () => {
			const backend = new EsMapCacheBackend<string, string>();
			const policy = new PolicyMock<string, string, string>();
			const cache = new PolicyBasedCache<string, string, string>(backend, [policy]);

			cache.events.eventMask = CacheEvent.INSERT;

			let eventKey;
			let eventValue;
			cache.events.on(CacheEvent.INSERT, (key, value) => {
				eventKey = key;
				eventValue = value;
			});

			cache.set('key', 'value', 'bundle');
			const entry = backend.get('key')!;

			expect(entry.value).to.be.eq('value');
			expect(backend.get('key')).to.be.deep.eq({ value: 'value' });

			const onSetInvocation = policy.methodBehaviours.get('onSet')!;
			expect(onSetInvocation.arguments![2]).to.be.eq('bundle');
			expect(onSetInvocation.calls).to.be.eq(1);

			expect(eventKey).to.be.eq('key');
			expect(eventValue).to.be.eq('value');
		});

		it('updates the value of the key if it was already present in the cache and emits event', () => {
			const backend = new EsMapCacheBackend<string, string>();
			const policy = new PolicyMock<string, string, string>();
			const cache = new PolicyBasedCache<string, string, string>(backend, [policy]);

			cache.events.eventMask = CacheEvent.INSERT | CacheEvent.UPDATE;

			let setEventKey;
			let setEventValue;
			let updateEventKey;
			let updateEventValue;
			cache.events.on(CacheEvent.INSERT, (key, value) => {
				setEventKey = key;
				setEventValue = value;
			});
			cache.events.on(CacheEvent.UPDATE, (key, value) => {
				updateEventKey = key;
				updateEventValue = value;
			});

			cache.set('key', 'value', 'bundle');
			const entry = backend.get('key')!;

			expect(entry.value).to.be.eq('value');
			expect(cache.size).to.be.eq(1);

			cache.set('key', 'new_value', 'new_bundle');
			expect(entry.value).to.be.eq('new_value');
			expect(backend.get('key')).to.be.deep.eq({ value: 'new_value' });
			expect(cache.size).to.be.eq(1);

			const onSetInvocation = policy.methodBehaviours.get('onSet')!;
			expect(onSetInvocation.arguments![2]).to.be.eq('bundle');
			expect(onSetInvocation.calls).to.be.eq(1);

			const onUpdateInvocation = policy.methodBehaviours.get('onUpdate')!;
			expect(onUpdateInvocation.arguments![1]).to.be.deep.eq({ value: 'new_value' });
			expect(onUpdateInvocation.calls).to.be.eq(1);

			expect(setEventKey).to.be.eq('key');
			expect(setEventValue).to.be.eq('value');
			expect(updateEventKey).to.be.eq('key');
			expect(updateEventValue).to.be.eq('new_value');
		});

		it('rolls back insertion if any of the policies "onSet" hook throws', () => {
			const backend = new EsMapCacheBackend<string, string>();
			const expirationPolicy = new PolicyMock<string, string, string>();
			const evictionPolicy = new PolicyMock<string, string, string>();
			const cache = new PolicyBasedCache<string, string, string>(backend, [expirationPolicy, evictionPolicy]);

			const expirationPolicyOnSetBehaviour = expirationPolicy.methodBehaviours.get('onSet')!;
			const evictionPolicyOnSetBehaviour = evictionPolicy.methodBehaviours.get('onSet')!;

			const expirationPolicyOnDeleteBehaviour = expirationPolicy.methodBehaviours.get('onDelete')!;
			const evictionPolicyOnDeleteBehaviour = evictionPolicy.methodBehaviours.get('onDelete')!;

			evictionPolicyOnSetBehaviour.throws = new Error('TEST');

			expect(() => cache.set('key', 'value')).to.throw('TEST');
			expect(backend.get('key')).to.be.eq(undefined);
			expect(cache.keys()).to.be.equalTo([]);

			expect(evictionPolicyOnSetBehaviour.calls).to.be.eq(1);
			expect(expirationPolicyOnSetBehaviour.calls).to.be.eq(1);
			expect(expirationPolicyOnDeleteBehaviour.calls).to.be.eq(1); // rollback
			expect(evictionPolicyOnDeleteBehaviour.calls).to.be.eq(0); // it thrown, so no need to rollback
		});
	});

	describe(`${PolicyBasedCache.prototype.del.name.magenta} spec`, () => {
		it('does not delete entry that does not exist', () => {
			const backend = new EsMapCacheBackend<string, any>();
			const cache = new PolicyBasedCache<string, any, any>(backend);

			expect(cache.del('key')).to.be.eq(false);
		});

		it('deletes entry from cache, calls policies "onDelete" hook and emits event', () => {
			const backend = new EsMapCacheBackend<string, string>();
			const policy1 = new PolicyMock<string, string, string>();
			const policy2 = new PolicyMock<string, string, string>();
			const policy3 = new PolicyMock<string, string, string>();
			const cache = new PolicyBasedCache<string, string, string>(backend, [policy1, policy2, policy3]);

			cache.events.eventMask = CacheEvent.DELETE;
			let eventKey;
			let eventValue;
			cache.events.on(CacheEvent.DELETE, (key, value) => {
				eventKey = key;
				eventValue = value;
			});

			cache.set('key', 'value');

			expect(cache.del('key')).to.be.eq(true);
			expect(cache.has('key')).to.be.eq(false);

			const methodBehaviour1 = policy1.methodBehaviours.get('onDelete')!;
			expect(methodBehaviour1.calls).to.be.eq(1);
			expect(methodBehaviour1.arguments![0]).to.be.eq('key');

			const methodBehaviour2 = policy2.methodBehaviours.get('onDelete')!;
			expect(methodBehaviour2.calls).to.be.eq(1);
			expect(methodBehaviour2.arguments![0]).to.be.eq('key');

			const methodBehaviour3 = policy3.methodBehaviours.get('onDelete')!;
			expect(methodBehaviour3.calls).to.be.eq(1);
			expect(methodBehaviour3.arguments![0]).to.be.eq('key');

			expect(eventKey).to.be.eq('key');
			expect(eventValue).to.be.eq('value');
		});

		it('policy deleter calls "onDelete" hook for all policies and then deletes entry from cache', () => {
			const backend = new EsMapCacheBackend<string, string>();
			const policy = new PolicyMock<string, string, string>();
			const cache = new PolicyBasedCache<string, string, string>(backend, [policy]);

			cache.events.eventMask = CacheEvent.DELETE;
			let eventKey;
			let eventValue;
			cache.events.on(CacheEvent.DELETE, (key, value) => {
				eventKey = key;
				eventValue = value;
			});

			cache.set('key', 'value');
			expect(cache.has('key')).to.be.eq(true);

			policy.deleteFromCache('key', backend.get('key')!);

			expect(cache.has('key')).to.be.eq(false);
			expect(policy.methodBehaviours.get('onDelete')!.arguments![0]).to.be.eq('key');

			expect(eventKey).to.be.eq('key');
			expect(eventValue).to.be.eq('value');
		});
	});

	describe(`${PolicyBasedCache.prototype.clear.name.magenta} spec`, () => {
		it('calls policies "onClear" hook, then clears the cache and emits event', () => {
			const backend = new EsMapCacheBackend<string, string>();
			const policy = new PolicyMock<string, string, string>();
			const cache = new PolicyBasedCache<string, string, string>(backend, [policy]);

			cache.events.eventMask = CacheEvent.FLUSH;
			let flushEmitted = false;
			cache.events.on(CacheEvent.FLUSH, () => {
				flushEmitted = true;
			});

			cache.set('key', 'value');
			expect(cache.size).to.be.eq(1);

			cache.clear();
			expect(cache.size).to.be.eq(0);
			expect(policy.methodBehaviours.get('onClear')!.calls).to.be.eq(1);

			expect(flushEmitted).to.be.eq(true);
		});
	});
});

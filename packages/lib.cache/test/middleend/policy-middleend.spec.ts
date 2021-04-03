import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import { PolicyBasedCacheMiddleEnd } from '../../lib/middleend/policy-based';
import { EsMapBackend } from '../../lib/backend/es-map';
import { PolicyMock } from '../mocks/policy';
import { EntryValidity } from '../../lib/contracts/replacement-policy';
import { CacheEvent } from '../../lib/contracts/cache-event-emitter';

describe(`${PolicyBasedCacheMiddleEnd.name.magenta} spec`, () => {
	describe(`${PolicyBasedCacheMiddleEnd.prototype.get.name.magenta} spec`, () => {
		it('returns undefined if item is not present in cache', () => {
			const backend = new EsMapBackend<string, any>();
			const middleEnd = new PolicyBasedCacheMiddleEnd<string, any, any>(backend);
			expect(middleEnd.get('key')).to.be.eq(undefined);
		});

		it('returns undefined if item was present in cache, but some of the policies decided that it needs to be evicted (e.g. expired)', () => {
			const backend = new EsMapBackend<string, any>();
			const policy = new PolicyMock<string, any, any>();
			const middleEnd = new PolicyBasedCacheMiddleEnd<string, any, any>(backend, [policy]);

			policy.methodBehaviours.get('onGet')!.returnValue = EntryValidity.NOT_VALID;
			backend.set('key', 'value');

			expect(middleEnd.get('key')).to.be.eq(undefined);
			expect(backend.get('key')).to.be.eq(undefined); // it also evicted from backend...
			expect(policy.methodBehaviours.get('onDelete')!.calls).to.be.eq(1); // ... via onDelete hook
		});

		it('returns value if key was present in cache (no policies registered)', () => {
			const backend = new EsMapBackend<string, any>();
			const middleEnd = new PolicyBasedCacheMiddleEnd<string, any, any>(backend);

			backend.set('key', 'value');
			expect(middleEnd.get('key')).to.be.eq('value');
		});

		it('returns value if key was present in cache and policies decided not to evict item', () => {
			const backend = new EsMapBackend<string, any>();
			const policy = new PolicyMock<string, any, any>();
			const middleEnd = new PolicyBasedCacheMiddleEnd<string, any, any>(backend, [policy]);

			policy.methodBehaviours.get('onGet')!.returnValue = EntryValidity.VALID;
			backend.set('key', 'value');

			expect(middleEnd.get('key')).to.be.eq('value');
			expect(policy.methodBehaviours.get('onGet')!.calls).to.be.eq(1);
			expect(policy.methodBehaviours.get('onGet')!.arguments![0]).to.be.eq('key');
		});
	});

	describe(`${PolicyBasedCacheMiddleEnd.prototype.has.name.magenta} spec`, () => {
		it('returns whether key is present in the cache without calling any policies hooks', () => {
			const backend = new EsMapBackend<string, any>();
			const policy = new PolicyMock<string, any, any>();
			const middleEnd = new PolicyBasedCacheMiddleEnd<string, any, any>(backend, [policy]);

			backend.set('key', 'value');

			expect(middleEnd.has('key')).to.be.eq(true);
			expect(policy.methodBehaviours.get('onGet')!.calls).to.be.eq(0);
		});
	});

	describe(`${PolicyBasedCacheMiddleEnd.prototype.set.name.magenta} spec`, () => {
		it('sets new key-value pair in the cache and emits event', () => {
			const backend = new EsMapBackend<string, string>();
			const policy = new PolicyMock<string, string, string>();
			const middleEnd = new PolicyBasedCacheMiddleEnd<string, string, string>(backend, [policy]);

			middleEnd.events.eventMask = CacheEvent.INSERT;

			let eventKey;
			let eventValue;
			middleEnd.events.on(CacheEvent.INSERT, (key, value) => {
				eventKey = key;
				eventValue = value;
			});

			middleEnd.set('key', 'value', 'bundle');
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
			const backend = new EsMapBackend<string, string>();
			const policy = new PolicyMock<string, string, string>();
			const middleEnd = new PolicyBasedCacheMiddleEnd<string, string, string>(backend, [policy]);

			middleEnd.events.eventMask = CacheEvent.INSERT | CacheEvent.UPDATE;

			let setEventKey;
			let setEventValue;
			let updateEventKey;
			let updateEventValue;
			middleEnd.events.on(CacheEvent.INSERT, (key, value) => {
				setEventKey = key;
				setEventValue = value;
			});
			middleEnd.events.on(CacheEvent.UPDATE, (key, value) => {
				updateEventKey = key;
				updateEventValue = value;
			});

			middleEnd.set('key', 'value', 'bundle');
			const entry = backend.get('key')!;

			expect(entry.value).to.be.eq('value');
			expect(middleEnd.size).to.be.eq(1);

			middleEnd.set('key', 'new_value', 'new_bundle');
			expect(entry.value).to.be.eq('new_value');
			expect(backend.get('key')).to.be.deep.eq({ value: 'new_value' });
			expect(middleEnd.size).to.be.eq(1);

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
			const backend = new EsMapBackend<string, string>();
			const expirationPolicy = new PolicyMock<string, string, string>();
			const evictionPolicy = new PolicyMock<string, string, string>();
			const middleEnd = new PolicyBasedCacheMiddleEnd<string, string, string>(backend, [expirationPolicy, evictionPolicy]);

			const expirationPolicyOnSetBehaviour = expirationPolicy.methodBehaviours.get('onSet')!;
			const evictionPolicyOnSetBehaviour = evictionPolicy.methodBehaviours.get('onSet')!;

			const expirationPolicyOnDeleteBehaviour = expirationPolicy.methodBehaviours.get('onDelete')!;
			const evictionPolicyOnDeleteBehaviour = evictionPolicy.methodBehaviours.get('onDelete')!;

			evictionPolicyOnSetBehaviour.throws = new Error('TEST');

			expect(() => middleEnd.set('key', 'value')).to.throw('TEST');
			expect(backend.get('key')).to.be.eq(undefined);
			expect(middleEnd.keys()).to.be.equalTo([]);

			expect(evictionPolicyOnSetBehaviour.calls).to.be.eq(1);
			expect(expirationPolicyOnSetBehaviour.calls).to.be.eq(1);
			expect(expirationPolicyOnDeleteBehaviour.calls).to.be.eq(1); // rollback
			expect(evictionPolicyOnDeleteBehaviour.calls).to.be.eq(0); // it thrown, so no need to rollback
		});
	});

	describe(`${PolicyBasedCacheMiddleEnd.prototype.del.name.magenta} spec`, () => {
		it('does not delete entry that does not exist', () => {
			const backend = new EsMapBackend<string, any>();
			const middleEnd = new PolicyBasedCacheMiddleEnd<string, any, any>(backend);

			expect(middleEnd.del('key')).to.be.eq(false);
		});

		it('deletes entry from cache, calls policies "onDelete" hook and emits event', () => {
			const backend = new EsMapBackend<string, string>();
			const policy1 = new PolicyMock<string, string, string>();
			const policy2 = new PolicyMock<string, string, string>();
			const policy3 = new PolicyMock<string, string, string>();
			const middleEnd = new PolicyBasedCacheMiddleEnd<string, string, string>(backend, [policy1, policy2, policy3]);

			middleEnd.events.eventMask = CacheEvent.DELETE;
			let eventKey;
			let eventValue;
			middleEnd.events.on(CacheEvent.DELETE, (key, value) => {
				eventKey = key;
				eventValue = value;
			});

			middleEnd.set('key', 'value');

			expect(middleEnd.del('key')).to.be.eq(true);
			expect(middleEnd.has('key')).to.be.eq(false);

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
			const backend = new EsMapBackend<string, string>();
			const policy = new PolicyMock<string, string, string>();
			const middleEnd = new PolicyBasedCacheMiddleEnd<string, string, string>(backend, [policy]);

			middleEnd.events.eventMask = CacheEvent.DELETE;
			let eventKey;
			let eventValue;
			middleEnd.events.on(CacheEvent.DELETE, (key, value) => {
				eventKey = key;
				eventValue = value;
			});

			middleEnd.set('key', 'value');
			expect(middleEnd.has('key')).to.be.eq(true);

			policy.deleteFromCache('key', backend.get('key')!);

			expect(middleEnd.has('key')).to.be.eq(false);
			expect(policy.methodBehaviours.get('onDelete')!.arguments![0]).to.be.eq('key');

			expect(eventKey).to.be.eq('key');
			expect(eventValue).to.be.eq('value');
		});
	});

	describe(`${PolicyBasedCacheMiddleEnd.prototype.clear.name.magenta} spec`, () => {
		it('calls policies "onClear" hook, then clears the cache and emits event', () => {
			const backend = new EsMapBackend<string, string>();
			const policy = new PolicyMock<string, string, string>();
			const middleEnd = new PolicyBasedCacheMiddleEnd<string, string, string>(backend, [policy]);

			middleEnd.events.eventMask = CacheEvent.FLUSH;
			let flushEmitted = false;
			middleEnd.events.on(CacheEvent.FLUSH, () => {
				flushEmitted = true;
			});

			middleEnd.set('key', 'value');
			expect(middleEnd.size).to.be.eq(1);

			middleEnd.clear();
			expect(middleEnd.size).to.be.eq(0);
			expect(policy.methodBehaviours.get('onClear')!.calls).to.be.eq(1);

			expect(flushEmitted).to.be.eq(true);
		});
	});
});

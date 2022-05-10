// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it } from 'mocha';
import { expect } from '@thermopylae/dev.unit-test';
import { EsMapCacheBackend, EntryValidity, PolicyPerKeyCache, CacheEvent } from '../../lib';
import { PolicyMock } from './mocks/policy';
import { NOT_FOUND_VALUE } from '../../lib/constants';

const enum PolicyTag {
	EXPIRATION,
	EVICTION,
	DEPENDENCIES
}

describe(`${PolicyPerKeyCache.name.magenta} spec`, () => {
	describe(`${PolicyPerKeyCache.prototype.get.name.magenta} & ${PolicyPerKeyCache.prototype.set.name.magenta} spec`, () => {
		it("calls 'onHit' hook for policies specified for that particular entry and emits events", () => {
			const backend = new EsMapCacheBackend<string, string>();
			const policy1 = new PolicyMock<string, string, any>();
			const policy2 = new PolicyMock<string, string, any>();
			const policy3 = new PolicyMock<string, string, any>();
			const cache = new PolicyPerKeyCache<string, string, PolicyTag>(
				backend,
				new Map([
					[PolicyTag.EXPIRATION, policy1],
					[PolicyTag.EVICTION, policy2],
					[PolicyTag.DEPENDENCIES, policy3]
				])
			);

			let insertEventKey;
			let insertEventValue;
			cache.on(CacheEvent.INSERT, (key, value) => {
				insertEventKey = key;
				insertEventValue = value;
			});
			let updateEventKey;
			let updateEventValue;
			cache.on(CacheEvent.UPDATE, (key, value) => {
				updateEventKey = key;
				updateEventValue = value;
			});

			cache.set('a', 'a', { policies: [PolicyTag.EXPIRATION] });
			cache.set('b', 'b', { policies: [PolicyTag.EVICTION, PolicyTag.DEPENDENCIES] });
			cache.set('c', 'c', { policies: [PolicyTag.EXPIRATION, PolicyTag.EVICTION, PolicyTag.DEPENDENCIES] });
			cache.set('d', 'd');

			expect(insertEventKey).to.be.eq('d');
			expect(insertEventValue).to.be.eq('d');
			expect(updateEventKey).to.be.eq(undefined);
			expect(updateEventValue).to.be.eq(undefined);

			expect(cache.get('a')).to.be.eq('a');
			expect(policy1.methodBehaviours.get('onHit')!.calls).to.be.eq(1);
			expect(policy1.methodBehaviours.get('onMiss')!.calls).to.be.eq(0);
			expect(policy2.methodBehaviours.get('onHit')!.calls).to.be.eq(0);
			expect(policy3.methodBehaviours.get('onHit')!.calls).to.be.eq(0);

			expect(cache.get('b')).to.be.eq('b');
			expect(policy1.methodBehaviours.get('onHit')!.calls).to.be.eq(1);
			expect(policy2.methodBehaviours.get('onHit')!.calls).to.be.eq(1);
			expect(policy2.methodBehaviours.get('onMiss')!.calls).to.be.eq(0);
			expect(policy3.methodBehaviours.get('onHit')!.calls).to.be.eq(1);
			expect(policy3.methodBehaviours.get('onMiss')!.calls).to.be.eq(0);

			expect(cache.get('c')).to.be.eq('c');
			expect(policy1.methodBehaviours.get('onHit')!.calls).to.be.eq(2);
			expect(policy2.methodBehaviours.get('onHit')!.calls).to.be.eq(2);
			expect(policy3.methodBehaviours.get('onHit')!.calls).to.be.eq(2);

			expect(cache.get('d')).to.be.eq('d');
			expect(policy1.methodBehaviours.get('onHit')!.calls).to.be.eq(3);
			expect(policy2.methodBehaviours.get('onHit')!.calls).to.be.eq(3);
			expect(policy3.methodBehaviours.get('onHit')!.calls).to.be.eq(3);

			expect(cache.get('e')).to.be.eq(NOT_FOUND_VALUE);
			expect(policy1.methodBehaviours.get('onHit')!.calls).to.be.eq(3);
			expect(policy2.methodBehaviours.get('onHit')!.calls).to.be.eq(3);
			expect(policy3.methodBehaviours.get('onHit')!.calls).to.be.eq(3);

			policy3.methodBehaviours.get('onHit')!.returnValue = EntryValidity.NOT_VALID;
			expect(cache.get('b')).to.be.eq(NOT_FOUND_VALUE);
			expect(policy1.methodBehaviours.get('onHit')!.calls).to.be.eq(3);
			expect(policy2.methodBehaviours.get('onHit')!.calls).to.be.eq(4);
			expect(policy3.methodBehaviours.get('onHit')!.calls).to.be.eq(4);
			expect(policy1.methodBehaviours.get('onDelete')!.calls).to.be.eq(0);
			expect(policy2.methodBehaviours.get('onDelete')!.calls).to.be.eq(1);
			expect(policy3.methodBehaviours.get('onDelete')!.calls).to.be.eq(1);

			expect(cache.get('c')).to.be.eq(NOT_FOUND_VALUE);
			expect(policy1.methodBehaviours.get('onHit')!.calls).to.be.eq(4);
			expect(policy2.methodBehaviours.get('onHit')!.calls).to.be.eq(5);
			expect(policy3.methodBehaviours.get('onHit')!.calls).to.be.eq(5);
			expect(policy1.methodBehaviours.get('onDelete')!.calls).to.be.eq(1);
			expect(policy2.methodBehaviours.get('onDelete')!.calls).to.be.eq(2);
			expect(policy3.methodBehaviours.get('onDelete')!.calls).to.be.eq(2);

			policy2.methodBehaviours.get('onHit')!.returnValue = EntryValidity.NOT_VALID;
			expect(cache.get('d')).to.be.eq(NOT_FOUND_VALUE);
			expect(policy1.methodBehaviours.get('onHit')!.calls).to.be.eq(5);
			expect(policy2.methodBehaviours.get('onHit')!.calls).to.be.eq(6);
			expect(policy3.methodBehaviours.get('onHit')!.calls).to.be.eq(5);
			expect(policy1.methodBehaviours.get('onDelete')!.calls).to.be.eq(2);
			expect(policy2.methodBehaviours.get('onDelete')!.calls).to.be.eq(3);
			expect(policy3.methodBehaviours.get('onDelete')!.calls).to.be.eq(3);

			policy1.methodBehaviours.get('onHit')!.returnValue = EntryValidity.NOT_VALID;
			expect(cache.get('a')).to.be.eq(NOT_FOUND_VALUE);
			expect(policy1.methodBehaviours.get('onHit')!.calls).to.be.eq(6);
			expect(policy2.methodBehaviours.get('onHit')!.calls).to.be.eq(6);
			expect(policy3.methodBehaviours.get('onHit')!.calls).to.be.eq(5);
			expect(policy1.methodBehaviours.get('onDelete')!.calls).to.be.eq(3);
			expect(policy2.methodBehaviours.get('onDelete')!.calls).to.be.eq(3);
			expect(policy3.methodBehaviours.get('onDelete')!.calls).to.be.eq(3);
		});

		it("calls 'onMiss' hook for all policies when key not found", () => {
			const backend = new EsMapCacheBackend<string, string>();
			const policy1 = new PolicyMock<string, string, any>();
			const policy2 = new PolicyMock<string, string, any>();
			const cache = new PolicyPerKeyCache<string, string, PolicyTag>(
				backend,
				new Map([
					[PolicyTag.EXPIRATION, policy1],
					[PolicyTag.EVICTION, policy2]
				])
			);

			expect(cache.get('key')).to.be.eq(undefined);

			const p1OnMiss = policy1.methodBehaviours.get('onMiss')!;
			expect(p1OnMiss.calls).to.be.eq(1);
			expect(p1OnMiss.arguments).to.be.equalTo(['key']);

			const p2OnMiss = policy2.methodBehaviours.get('onMiss')!;
			expect(p2OnMiss.calls).to.be.eq(1);
			expect(p2OnMiss.arguments).to.be.equalTo(['key']);
		});

		it("calls 'onUpdate' hook for policies specified for that particular entry and emits events", () => {
			const backend = new EsMapCacheBackend<string, string>();
			const policy1 = new PolicyMock<string, string, any>();
			const policy2 = new PolicyMock<string, string, any>();
			const policy3 = new PolicyMock<string, string, any>();
			const cache = new PolicyPerKeyCache<string, string, PolicyTag>(
				backend,
				new Map([
					[PolicyTag.EXPIRATION, policy1],
					[PolicyTag.EVICTION, policy2],
					[PolicyTag.DEPENDENCIES, policy3]
				])
			);

			let updateEventKey;
			let updateEventValue;
			cache.on(CacheEvent.UPDATE, (key, value) => {
				updateEventKey = key;
				updateEventValue = value;
			});

			cache.set('a', 'a', { policies: [PolicyTag.EXPIRATION] });
			cache.set('b', 'b', { policies: [PolicyTag.EVICTION, PolicyTag.DEPENDENCIES] });
			expect(updateEventKey).to.be.eq(undefined);
			expect(updateEventValue).to.be.eq(undefined);

			cache.set('a', 'a1', { policies: [PolicyTag.EVICTION] }); // policies are ignored
			expect(policy1.methodBehaviours.get('onUpdate')!.calls).to.be.eq(1);
			expect(policy2.methodBehaviours.get('onUpdate')!.calls).to.be.eq(0); // ignored our policies from update
			expect(policy3.methodBehaviours.get('onUpdate')!.calls).to.be.eq(0);

			cache.set('b', 'b1');
			expect(policy1.methodBehaviours.get('onUpdate')!.calls).to.be.eq(1); // was not tracked by this policy
			expect(policy2.methodBehaviours.get('onUpdate')!.calls).to.be.eq(1);
			expect(policy3.methodBehaviours.get('onUpdate')!.calls).to.be.eq(1);

			expect(updateEventKey).to.be.eq('b');
			expect(updateEventValue).to.be.eq('b1');
		});
	});

	describe(`${PolicyPerKeyCache.prototype.del.name.magenta} spec`, () => {
		it("calls 'onDelete' hook for policies specified for that particular entry and emits events", () => {
			const backend = new EsMapCacheBackend<string, string>();
			const policy1 = new PolicyMock<string, string, any>();
			const policy2 = new PolicyMock<string, string, any>();
			const policy3 = new PolicyMock<string, string, any>();
			const cache = new PolicyPerKeyCache<string, string, PolicyTag>(
				backend,
				new Map([
					[PolicyTag.EXPIRATION, policy1],
					[PolicyTag.EVICTION, policy2],
					[PolicyTag.DEPENDENCIES, policy3]
				])
			);

			let eventKey;
			let eventValue;
			cache.on(CacheEvent.DELETE, (key, value) => {
				eventKey = key;
				eventValue = value;
			});

			cache.set('a', 'a', { policies: [PolicyTag.EXPIRATION] });
			cache.set('b', 'b', { policies: [PolicyTag.EVICTION, PolicyTag.DEPENDENCIES] });
			cache.set('c', 'c', { policies: [PolicyTag.EXPIRATION, PolicyTag.EVICTION, PolicyTag.DEPENDENCIES] });
			cache.set('d', 'd');

			cache.del('a');
			expect(backend.has('a')).to.be.eq(false);
			expect(cache.has('a')).to.be.eq(false);
			expect(policy1.methodBehaviours.get('onDelete')!.calls).to.be.eq(1);
			expect(policy2.methodBehaviours.get('onDelete')!.calls).to.be.eq(0);
			expect(policy3.methodBehaviours.get('onDelete')!.calls).to.be.eq(0);

			cache.del('b');
			expect(backend.has('b')).to.be.eq(false);
			expect(cache.has('b')).to.be.eq(false);
			expect(policy1.methodBehaviours.get('onDelete')!.calls).to.be.eq(1);
			expect(policy2.methodBehaviours.get('onDelete')!.calls).to.be.eq(1);
			expect(policy3.methodBehaviours.get('onDelete')!.calls).to.be.eq(1);

			cache.del('c');
			expect(backend.has('c')).to.be.eq(false);
			expect(cache.has('c')).to.be.eq(false);
			expect(policy1.methodBehaviours.get('onDelete')!.calls).to.be.eq(2);
			expect(policy2.methodBehaviours.get('onDelete')!.calls).to.be.eq(2);
			expect(policy3.methodBehaviours.get('onDelete')!.calls).to.be.eq(2);

			expect(cache.del('d')).to.be.eq(true);
			expect(backend.has('d')).to.be.eq(false);
			expect(cache.has('d')).to.be.eq(false);
			expect(policy1.methodBehaviours.get('onDelete')!.calls).to.be.eq(3);
			expect(policy2.methodBehaviours.get('onDelete')!.calls).to.be.eq(3);
			expect(policy3.methodBehaviours.get('onDelete')!.calls).to.be.eq(3);

			expect(eventKey).to.be.eq('d');
			expect(eventValue).to.be.eq('d');
			eventKey = undefined;
			eventValue = undefined;

			expect(cache.del('e')).to.be.eq(false);
			expect(backend.has('e')).to.be.eq(false);
			expect(policy1.methodBehaviours.get('onDelete')!.calls).to.be.eq(3);
			expect(policy2.methodBehaviours.get('onDelete')!.calls).to.be.eq(3);
			expect(policy3.methodBehaviours.get('onDelete')!.calls).to.be.eq(3);
			expect(eventKey).to.be.eq(undefined);
			expect(eventValue).to.be.eq(undefined);
		});
	});

	describe(`${PolicyPerKeyCache.prototype.clear.name.magenta} spec`, () => {
		it("calls 'onClear' hook for all policies and emits events", () => {
			const backend = new EsMapCacheBackend<string, string>();
			const policy1 = new PolicyMock<string, string, any>();
			const policy2 = new PolicyMock<string, string, any>();
			const policy3 = new PolicyMock<string, string, any>();
			const cache = new PolicyPerKeyCache<string, string, PolicyTag>(
				backend,
				new Map([
					[PolicyTag.EXPIRATION, policy1],
					[PolicyTag.EVICTION, policy2],
					[PolicyTag.DEPENDENCIES, policy3]
				])
			);

			let clearEventEmitted = false;
			cache.on(CacheEvent.FLUSH, () => {
				clearEventEmitted = true;
			});

			cache.set('a', 'a', { policies: [PolicyTag.EXPIRATION] });
			cache.set('b', 'b', { policies: [PolicyTag.EVICTION, PolicyTag.DEPENDENCIES] });
			cache.set('c', 'c', { policies: [PolicyTag.EXPIRATION, PolicyTag.EVICTION, PolicyTag.DEPENDENCIES] });
			cache.set('d', 'd');
			expect(cache.size).to.be.eq(4);
			expect(cache.keys()).to.be.equalTo(['a', 'b', 'c', 'd']);

			cache.clear();
			expect(cache.size).to.be.eq(0);
			expect(cache.keys()).to.be.ofSize(0);
			expect(backend.size).to.be.eq(0);

			expect(policy1.methodBehaviours.get('onClear')!.calls).to.be.eq(1);
			expect(policy2.methodBehaviours.get('onClear')!.calls).to.be.eq(1);
			expect(policy3.methodBehaviours.get('onClear')!.calls).to.be.eq(1);

			expect(clearEventEmitted).to.be.eq(true);
		});
	});
});

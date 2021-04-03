import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import { EsMapBackend } from '../../lib/backend/es-map';
import { PolicyMock } from '../mocks/policy';
import { EntryValidity } from '../../lib/contracts/replacement-policy';
import { PolicyPerKeyCacheMiddleEnd } from '../../lib/middleend/policy-per-key';
import { NOT_FOUND_VALUE } from '../../lib/constants';
import { CacheEvent } from '../../lib/contracts/cache-event-emitter';

const enum PolicyTag {
	EXPIRATION,
	EVICTION,
	DEPENDENCIES
}

describe(`${PolicyPerKeyCacheMiddleEnd.name.magenta} spec`, () => {
	describe(`${PolicyPerKeyCacheMiddleEnd.prototype.get.name.magenta} & ${PolicyPerKeyCacheMiddleEnd.prototype.set.name.magenta} spec`, () => {
		it("calls 'onGet' hook for policies specified for that particular entry and emits events", () => {
			const backend = new EsMapBackend<string, string>();
			const policy1 = new PolicyMock<string, string, any>();
			const policy2 = new PolicyMock<string, string, any>();
			const policy3 = new PolicyMock<string, string, any>();
			const middleEnd = new PolicyPerKeyCacheMiddleEnd<string, string, PolicyTag>(
				backend,
				new Map([
					[PolicyTag.EXPIRATION, policy1],
					[PolicyTag.EVICTION, policy2],
					[PolicyTag.DEPENDENCIES, policy3]
				])
			);

			middleEnd.events.eventMask = CacheEvent.INSERT | CacheEvent.UPDATE;
			let insertEventKey;
			let insertEventValue;
			middleEnd.events.on(CacheEvent.INSERT, (key, value) => {
				insertEventKey = key;
				insertEventValue = value;
			});
			let updateEventKey;
			let updateEventValue;
			middleEnd.events.on(CacheEvent.UPDATE, (key, value) => {
				updateEventKey = key;
				updateEventValue = value;
			});

			middleEnd.set('a', 'a', { policies: [PolicyTag.EXPIRATION] });
			middleEnd.set('b', 'b', { policies: [PolicyTag.EVICTION, PolicyTag.DEPENDENCIES] });
			middleEnd.set('c', 'c', { policies: [PolicyTag.EXPIRATION, PolicyTag.EVICTION, PolicyTag.DEPENDENCIES] });
			middleEnd.set('d', 'd');

			expect(insertEventKey).to.be.eq('d');
			expect(insertEventValue).to.be.eq('d');
			expect(updateEventKey).to.be.eq(undefined);
			expect(updateEventValue).to.be.eq(undefined);

			expect(middleEnd.get('a')).to.be.eq('a');
			expect(policy1.methodBehaviours.get('onGet')!.calls).to.be.eq(1);
			expect(policy2.methodBehaviours.get('onGet')!.calls).to.be.eq(0);
			expect(policy3.methodBehaviours.get('onGet')!.calls).to.be.eq(0);

			expect(middleEnd.get('b')).to.be.eq('b');
			expect(policy1.methodBehaviours.get('onGet')!.calls).to.be.eq(1);
			expect(policy2.methodBehaviours.get('onGet')!.calls).to.be.eq(1);
			expect(policy3.methodBehaviours.get('onGet')!.calls).to.be.eq(1);

			expect(middleEnd.get('c')).to.be.eq('c');
			expect(policy1.methodBehaviours.get('onGet')!.calls).to.be.eq(2);
			expect(policy2.methodBehaviours.get('onGet')!.calls).to.be.eq(2);
			expect(policy3.methodBehaviours.get('onGet')!.calls).to.be.eq(2);

			expect(middleEnd.get('d')).to.be.eq('d');
			expect(policy1.methodBehaviours.get('onGet')!.calls).to.be.eq(3);
			expect(policy2.methodBehaviours.get('onGet')!.calls).to.be.eq(3);
			expect(policy3.methodBehaviours.get('onGet')!.calls).to.be.eq(3);

			expect(middleEnd.get('e')).to.be.eq(NOT_FOUND_VALUE);
			expect(policy1.methodBehaviours.get('onGet')!.calls).to.be.eq(3);
			expect(policy2.methodBehaviours.get('onGet')!.calls).to.be.eq(3);
			expect(policy3.methodBehaviours.get('onGet')!.calls).to.be.eq(3);

			policy3.methodBehaviours.get('onGet')!.returnValue = EntryValidity.NOT_VALID;
			expect(middleEnd.get('b')).to.be.eq(NOT_FOUND_VALUE);
			expect(policy1.methodBehaviours.get('onGet')!.calls).to.be.eq(3);
			expect(policy2.methodBehaviours.get('onGet')!.calls).to.be.eq(4);
			expect(policy3.methodBehaviours.get('onGet')!.calls).to.be.eq(4);
			expect(policy1.methodBehaviours.get('onDelete')!.calls).to.be.eq(0);
			expect(policy2.methodBehaviours.get('onDelete')!.calls).to.be.eq(1);
			expect(policy3.methodBehaviours.get('onDelete')!.calls).to.be.eq(1);

			expect(middleEnd.get('c')).to.be.eq(NOT_FOUND_VALUE);
			expect(policy1.methodBehaviours.get('onGet')!.calls).to.be.eq(4);
			expect(policy2.methodBehaviours.get('onGet')!.calls).to.be.eq(5);
			expect(policy3.methodBehaviours.get('onGet')!.calls).to.be.eq(5);
			expect(policy1.methodBehaviours.get('onDelete')!.calls).to.be.eq(1);
			expect(policy2.methodBehaviours.get('onDelete')!.calls).to.be.eq(2);
			expect(policy3.methodBehaviours.get('onDelete')!.calls).to.be.eq(2);

			policy2.methodBehaviours.get('onGet')!.returnValue = EntryValidity.NOT_VALID;
			expect(middleEnd.get('d')).to.be.eq(NOT_FOUND_VALUE);
			expect(policy1.methodBehaviours.get('onGet')!.calls).to.be.eq(5);
			expect(policy2.methodBehaviours.get('onGet')!.calls).to.be.eq(6);
			expect(policy3.methodBehaviours.get('onGet')!.calls).to.be.eq(5);
			expect(policy1.methodBehaviours.get('onDelete')!.calls).to.be.eq(2);
			expect(policy2.methodBehaviours.get('onDelete')!.calls).to.be.eq(3);
			expect(policy3.methodBehaviours.get('onDelete')!.calls).to.be.eq(3);

			policy1.methodBehaviours.get('onGet')!.returnValue = EntryValidity.NOT_VALID;
			expect(middleEnd.get('a')).to.be.eq(NOT_FOUND_VALUE);
			expect(policy1.methodBehaviours.get('onGet')!.calls).to.be.eq(6);
			expect(policy2.methodBehaviours.get('onGet')!.calls).to.be.eq(6);
			expect(policy3.methodBehaviours.get('onGet')!.calls).to.be.eq(5);
			expect(policy1.methodBehaviours.get('onDelete')!.calls).to.be.eq(3);
			expect(policy2.methodBehaviours.get('onDelete')!.calls).to.be.eq(3);
			expect(policy3.methodBehaviours.get('onDelete')!.calls).to.be.eq(3);
		});

		it("calls 'onUpdate' hook for policies specified for that particular entry and emits events", () => {
			const backend = new EsMapBackend<string, string>();
			const policy1 = new PolicyMock<string, string, any>();
			const policy2 = new PolicyMock<string, string, any>();
			const policy3 = new PolicyMock<string, string, any>();
			const middleEnd = new PolicyPerKeyCacheMiddleEnd<string, string, PolicyTag>(
				backend,
				new Map([
					[PolicyTag.EXPIRATION, policy1],
					[PolicyTag.EVICTION, policy2],
					[PolicyTag.DEPENDENCIES, policy3]
				])
			);

			middleEnd.events.eventMask = CacheEvent.INSERT | CacheEvent.UPDATE;
			let updateEventKey;
			let updateEventValue;
			middleEnd.events.on(CacheEvent.UPDATE, (key, value) => {
				updateEventKey = key;
				updateEventValue = value;
			});

			middleEnd.set('a', 'a', { policies: [PolicyTag.EXPIRATION] });
			middleEnd.set('b', 'b', { policies: [PolicyTag.EVICTION, PolicyTag.DEPENDENCIES] });
			expect(updateEventKey).to.be.eq(undefined);
			expect(updateEventValue).to.be.eq(undefined);

			middleEnd.set('a', 'a1', { policies: [PolicyTag.EVICTION] }); // policies are ignored
			expect(policy1.methodBehaviours.get('onUpdate')!.calls).to.be.eq(1);
			expect(policy2.methodBehaviours.get('onUpdate')!.calls).to.be.eq(0); // ignored our policies from update
			expect(policy3.methodBehaviours.get('onUpdate')!.calls).to.be.eq(0);

			middleEnd.set('b', 'b1');
			expect(policy1.methodBehaviours.get('onUpdate')!.calls).to.be.eq(1); // was not tracked by this policy
			expect(policy2.methodBehaviours.get('onUpdate')!.calls).to.be.eq(1);
			expect(policy3.methodBehaviours.get('onUpdate')!.calls).to.be.eq(1);

			expect(updateEventKey).to.be.eq('b');
			expect(updateEventValue).to.be.eq('b1');
		});
	});

	describe(`${PolicyPerKeyCacheMiddleEnd.prototype.del.name.magenta} spec`, () => {
		it("calls 'onDelete' hook for policies specified for that particular entry and emits events", () => {
			const backend = new EsMapBackend<string, string>();
			const policy1 = new PolicyMock<string, string, any>();
			const policy2 = new PolicyMock<string, string, any>();
			const policy3 = new PolicyMock<string, string, any>();
			const middleEnd = new PolicyPerKeyCacheMiddleEnd<string, string, PolicyTag>(
				backend,
				new Map([
					[PolicyTag.EXPIRATION, policy1],
					[PolicyTag.EVICTION, policy2],
					[PolicyTag.DEPENDENCIES, policy3]
				])
			);

			middleEnd.events.eventMask = CacheEvent.DELETE;
			let eventKey;
			let eventValue;
			middleEnd.events.on(CacheEvent.DELETE, (key, value) => {
				eventKey = key;
				eventValue = value;
			});

			middleEnd.set('a', 'a', { policies: [PolicyTag.EXPIRATION] });
			middleEnd.set('b', 'b', { policies: [PolicyTag.EVICTION, PolicyTag.DEPENDENCIES] });
			middleEnd.set('c', 'c', { policies: [PolicyTag.EXPIRATION, PolicyTag.EVICTION, PolicyTag.DEPENDENCIES] });
			middleEnd.set('d', 'd');

			middleEnd.del('a');
			expect(backend.has('a')).to.be.eq(false);
			expect(middleEnd.has('a')).to.be.eq(false);
			expect(policy1.methodBehaviours.get('onDelete')!.calls).to.be.eq(1);
			expect(policy2.methodBehaviours.get('onDelete')!.calls).to.be.eq(0);
			expect(policy3.methodBehaviours.get('onDelete')!.calls).to.be.eq(0);

			middleEnd.del('b');
			expect(backend.has('b')).to.be.eq(false);
			expect(middleEnd.has('b')).to.be.eq(false);
			expect(policy1.methodBehaviours.get('onDelete')!.calls).to.be.eq(1);
			expect(policy2.methodBehaviours.get('onDelete')!.calls).to.be.eq(1);
			expect(policy3.methodBehaviours.get('onDelete')!.calls).to.be.eq(1);

			middleEnd.del('c');
			expect(backend.has('c')).to.be.eq(false);
			expect(middleEnd.has('c')).to.be.eq(false);
			expect(policy1.methodBehaviours.get('onDelete')!.calls).to.be.eq(2);
			expect(policy2.methodBehaviours.get('onDelete')!.calls).to.be.eq(2);
			expect(policy3.methodBehaviours.get('onDelete')!.calls).to.be.eq(2);

			expect(middleEnd.del('d')).to.be.eq(true);
			expect(backend.has('d')).to.be.eq(false);
			expect(middleEnd.has('d')).to.be.eq(false);
			expect(policy1.methodBehaviours.get('onDelete')!.calls).to.be.eq(3);
			expect(policy2.methodBehaviours.get('onDelete')!.calls).to.be.eq(3);
			expect(policy3.methodBehaviours.get('onDelete')!.calls).to.be.eq(3);

			expect(eventKey).to.be.eq('d');
			expect(eventValue).to.be.eq('d');
			eventKey = undefined;
			eventValue = undefined;

			expect(middleEnd.del('e')).to.be.eq(false);
			expect(backend.has('e')).to.be.eq(false);
			expect(policy1.methodBehaviours.get('onDelete')!.calls).to.be.eq(3);
			expect(policy2.methodBehaviours.get('onDelete')!.calls).to.be.eq(3);
			expect(policy3.methodBehaviours.get('onDelete')!.calls).to.be.eq(3);
			expect(eventKey).to.be.eq(undefined);
			expect(eventValue).to.be.eq(undefined);
		});
	});

	describe(`${PolicyPerKeyCacheMiddleEnd.prototype.clear.name.magenta} spec`, () => {
		it("calls 'onClear' hook for all policies and emits events", () => {
			const backend = new EsMapBackend<string, string>();
			const policy1 = new PolicyMock<string, string, any>();
			const policy2 = new PolicyMock<string, string, any>();
			const policy3 = new PolicyMock<string, string, any>();
			const middleEnd = new PolicyPerKeyCacheMiddleEnd<string, string, PolicyTag>(
				backend,
				new Map([
					[PolicyTag.EXPIRATION, policy1],
					[PolicyTag.EVICTION, policy2],
					[PolicyTag.DEPENDENCIES, policy3]
				])
			);

			middleEnd.events.eventMask = CacheEvent.FLUSH;
			let clearEventEmitted = false;
			middleEnd.events.on(CacheEvent.FLUSH, () => {
				clearEventEmitted = true;
			});

			middleEnd.set('a', 'a', { policies: [PolicyTag.EXPIRATION] });
			middleEnd.set('b', 'b', { policies: [PolicyTag.EVICTION, PolicyTag.DEPENDENCIES] });
			middleEnd.set('c', 'c', { policies: [PolicyTag.EXPIRATION, PolicyTag.EVICTION, PolicyTag.DEPENDENCIES] });
			middleEnd.set('d', 'd');
			expect(middleEnd.size).to.be.eq(4);
			expect(middleEnd.keys()).to.be.equalTo(['a', 'b', 'c', 'd']);

			middleEnd.clear();
			expect(middleEnd.size).to.be.eq(0);
			expect(middleEnd.keys()).to.be.ofSize(0);
			expect(backend.size).to.be.eq(0);

			expect(policy1.methodBehaviours.get('onClear')!.calls).to.be.eq(1);
			expect(policy2.methodBehaviours.get('onClear')!.calls).to.be.eq(1);
			expect(policy3.methodBehaviours.get('onClear')!.calls).to.be.eq(1);

			expect(clearEventEmitted).to.be.eq(true);
		});
	});
});

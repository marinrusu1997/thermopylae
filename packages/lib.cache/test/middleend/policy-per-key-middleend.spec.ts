import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import { EsMapBackend } from '../../lib/backend/es-map';
import { PolicyMock } from '../mocks/policy';
import { EntryValidity } from '../../lib/contracts/replacement-policy';
import { PolicyPerKeyCacheMiddleEnd } from '../../lib/middleend/policy-per-key';
import { NOT_FOUND_VALUE } from '../../lib/constants';

const enum PolicyTag {
	EXPIRATION,
	EVICTION,
	DEPENDENCIES
}

describe.only(`${PolicyPerKeyCacheMiddleEnd.name.magenta} spec`, () => {
	describe(`${PolicyPerKeyCacheMiddleEnd.prototype.get.name.magenta} spec`, () => {
		it("calls 'onGet' hook for policies specified for that particular entry", () => {
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

			middleEnd.set('a', 'a', { policies: [PolicyTag.EXPIRATION] });
			middleEnd.set('b', 'b', { policies: [PolicyTag.EVICTION, PolicyTag.DEPENDENCIES] });
			middleEnd.set('c', 'c', { policies: [PolicyTag.EXPIRATION, PolicyTag.EVICTION, PolicyTag.DEPENDENCIES] });
			middleEnd.set('d', 'd');

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
	});
});

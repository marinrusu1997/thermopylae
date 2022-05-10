// eslint-disable-next-line import/no-extraneous-dependencies
import chai, { Assertion } from 'chai';
import chaiArrays from 'chai-arrays';
import chaiAsPromised from 'chai-as-promised';
// @ts-ignore We use them for testing
import chaiAssertType from 'chai-asserttype';
// @ts-ignore We use them for testing
import chaiDateString from 'chai-date-string';

chai.use(chaiArrays);
chai.use(chaiAsPromised);
chai.use(chaiAssertType);
chai.use(chaiDateString);

Assertion.addChainableMethod('in', function isNumber(args): void {
	const comparison = typeof args === 'number';
	const expectation = 'expected type #{exp} but got #{act}';
	const actual = 'expected to not have type #{act}';
	this.assert(comparison, expectation, actual, typeof args, 'number');
});

Assertion.addMethod('range', function isInRange(...args): void {
	// eslint-disable-next-line no-underscore-dangle
	const num: number = this._obj as number;
	const comparison = num >= args[0] && num <= args[1];
	const expectation = `expected #{act} to be in range #{exp}`;
	this.assert(comparison, expectation, expectation, `${args[0]}-${args[1]}`, num);
});

const { expect, assert } = chai;

export { chai, expect, assert };

import { describe, it } from 'mocha';
import { chai } from './chai';
import { removeItemFromArray } from '../lib/misc';

const { assert, expect } = chai;

describe('misc spec', () => {
	it('removes item from array if it exists', () => {
		const arr = [1, 2, 3];
		assert(removeItemFromArray(1, arr));
		expect(arr.length).to.be.equal(2);
	});

	it("doesn't remove item from array if it was not found", () => {
		const arr = ['str1', 'str2'];
		assert(!removeItemFromArray('str0', arr));
		expect(arr.length).to.be.equal(2);
	});
});

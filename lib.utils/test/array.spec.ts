import { describe, it } from 'mocha';
import { assert, expect } from 'chai';
import { extractUniqueItems, removeItemFromArray } from '../lib/array';

describe('array spec', () => {
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

	it('extracts unique items from array', () => {
		const numericArray = [1, 2, 1, 2, 2, 3];
		expect(extractUniqueItems(numericArray)).to.be.deep.eq([1, 2, 3]);
		const stringsArray = ['a', 'b', 'c', 'a', 'd', 'b'];
		expect(extractUniqueItems(stringsArray)).to.be.deep.eq(['a', 'b', 'c', 'd']);
	});
});

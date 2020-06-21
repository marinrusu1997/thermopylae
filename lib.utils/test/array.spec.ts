import { describe, it } from 'mocha';
import { expect } from 'chai';
import { extractUnique, filledWith, remove } from '../lib/array';

describe('array spec', () => {
	// eslint-disable-next-line mocha/no-setup-in-describe
	describe(`${remove.name} spec`, () => {
		it('removes item from array if it exists', () => {
			const arr = [1, 2, 3];
			expect(remove(arr, (x) => x === 1).length).to.be.eq(2);
			expect(arr.length).to.be.equal(2);
		});

		it("doesn't remove item from array if it was not found", () => {
			const arr = ['str1', 'str2'];
			expect(remove(arr, (x) => x === 'str0').length).to.be.eq(2);
			expect(arr.length).to.be.equal(2);
		});

		it('removes item from array in place', () => {
			const arr = [{ key: 'val' }, 2, 3];
			expect(remove(arr, (x) => x === 2).length).to.be.eq(2);
			expect(arr.length).to.be.equal(2);
		});

		it('removes item from array using a copy', () => {
			const arrOriginal = [{ key: 'val' }, 2, 3];
			const arrCopy = remove(arrOriginal, (x) => x === 3, false);
			expect(arrCopy.length).to.be.eq(2);
			expect(arrOriginal.length).to.be.equal(3);
		});

		it('removes only first occurrence', () => {
			const arr = [{ key: 'val' }, 2, 3, 'str1', true, true];
			remove(arr, (x) => typeof x === 'boolean' && x, true, true);
			expect(arr.length).to.be.equal(5);
		});

		it('removes all occurrences', () => {
			const arr = [{ key: 'val' }, 2, 3, 'str1', true, true];
			remove(arr, (x) => typeof x === 'boolean' && x, true, false);
			expect(arr.length).to.be.equal(4);
		});
	});

	// eslint-disable-next-line mocha/no-setup-in-describe
	describe(`${filledWith.name} spec`, () => {
		it('throws on negative length', () => {
			expect(() => filledWith(-1, undefined)).to.throw('Invalid array length');
		});

		it('fills array with provided value', () => {
			const length = 10;
			const toFill = `val-${Date.now()}`;
			const arr = filledWith(length, toFill);

			expect(arr.length).to.be.eq(length);
			for (let i = 0; i < length; i++) {
				expect(arr[i]).to.be.eq(toFill);
			}
		});

		it('fills array by calling provided function', () => {
			const length = 10;

			const generated: Array<number> = [];
			function generator(): number {
				const num = Math.random();
				generated.push(num);
				return num;
			}

			const arr = filledWith(length, generator);

			expect(arr.length).to.be.eq(length);
			for (let i = 0; i < length; i++) {
				expect(arr[i]).to.be.eq(generated[i]);
			}
		});
	});

	it('extracts unique items from array', () => {
		const numericArray = [1, 2, 1, 2, 2, 3];
		expect(extractUnique(numericArray)).to.be.deep.eq([1, 2, 3]);
		const stringsArray = ['a', 'b', 'c', 'a', 'd', 'b'];
		expect(extractUnique(stringsArray)).to.be.deep.eq(['a', 'b', 'c', 'd']);
	});
});

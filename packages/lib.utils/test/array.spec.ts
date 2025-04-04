import { ConcurrencyType } from '@thermopylae/core.declarations';
import { describe, expect, it } from 'vitest';
import { filledWith, filterAsync, peek, randomElement, remove, shuffle, unique } from '../lib/array.js';
import { chrono } from '../lib/index.js';

describe('array spec', () => {
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
			const arr = [{ key: 'val' }, 2, true, 3, 'str1', true];
			remove(arr, (x) => typeof x === 'boolean' && x, true, true);
			expect(arr.length).to.be.equal(5);
			expect(arr[2]).to.be.eq(3); // `3` took place of first `true`
		});

		it('removes all occurrences (at the end)', () => {
			const arr = [{ key: 'val' }, 2, 3, 'str1', true, true];
			remove(arr, (x) => typeof x === 'boolean' && x, true, false);
			expect(arr.length).to.be.equal(4);
			expect(peek(arr)).to.be.eq('str1');
		});

		it('removes all occurrences (at the start)', () => {
			const arr = [true, true, { key: 'val' }, 2, 3, 'str1'];
			remove(arr, (x) => typeof x === 'boolean' && x, true, false);
			expect(arr.length).to.be.equal(4);
			expect(typeof arr[0]).to.be.eq('object');
		});

		it('removes all occurrences (everywhere)', () => {
			const arr = [true, true, false, { key: 'val' }, 2, true, true, false, 3, 'str1', true, true];
			remove(arr, (x) => typeof x === 'boolean' && x, true, false);
			expect(arr.length).to.be.equal(6);
			expect(arr[0]).to.be.eq(false);
			expect(peek(arr)).to.be.eq('str1');
		});
	});

	describe(`${filledWith.name} spec`, () => {
		it('throws on negative length', () => {
			expect(() => filledWith(-1, undefined)).to.throw('Invalid array length');
		});

		it('returns empty array when length is 0', () => {
			expect(filledWith(0, 0).length).to.be.eq(0);
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

		it('fills array without duplicates', () => {
			const length = 50;

			const generated: Array<number> = [];
			function generator(): number {
				const num = Math.random();

				if (Math.random() < 0.5 && generated.length) {
					return generated[0];
				}

				generated.push(num);
				return num;
			}

			const arr = filledWith(length, generator, { noDuplicates: true });

			expect(arr).to.be.of.length(length); // generated array with desired length
			expect(arr).to.be.of.length(new Set(arr).size); // without duplicates

			for (let i = 0; i < length; i++) {
				expect(arr[i]).to.be.eq(generated[i]);
			}
		});
	});

	describe(`${unique.name} spec`, () => {
		it('extracts unique items from array', () => {
			const numericArray = [1, 2, 1, 2, 2, 3];
			expect(unique(numericArray)).to.be.deep.eq([1, 2, 3]);
			const stringsArray = ['a', 'b', 'c', 'a', 'd', 'b'];
			expect(unique(stringsArray)).to.be.deep.eq(['a', 'b', 'c', 'd']);
		});
	});

	describe(`${shuffle.name} spec`, () => {
		it('shuffles in random order', () => {
			const arr = [1, 2, 3, 4, 5];
			const original = arr.slice();

			shuffle(arr);
			try {
				expect(arr).not.toStrictEqual(original);
			} catch {
				expect(arr).toStrictEqual(original); // sometimes random order might be the same as the input one
			}
		});
	});

	describe(`${randomElement.name} spec`, () => {
		it('throws when array is empty', () => {
			expect(() => randomElement([])).to.throw('0 is greater than -1');
		});

		it('returns first item when array contains a single element', () => {
			expect(randomElement([1])).to.be.eq(1);
		});

		it('returns random element from array', () => {
			const arr = [1, 2];
			expect(randomElement(arr)).to.be.oneOf(arr);
		});
	});

	describe(`${filterAsync.name} spec`, () => {
		it('filters in parallel', async () => {
			const arr = [1, 2, 3, 4, 5];
			async function filter(i: number): Promise<boolean> {
				await chrono.sleep(10);
				return i % 2 === 0;
			}

			const start = Date.now();
			const filtered = await filterAsync(arr, filter);
			const stop = Date.now();

			expect(stop - start).to.be.at.most(30);
			expect(filtered).toStrictEqual([2, 4]);
		});

		it('filters sequentially', async () => {
			const arr = [1, 2, 3, 4, 5];
			async function filter(i: number): Promise<boolean> {
				await chrono.sleep(10);
				return i % 2 === 0;
			}

			const start = Date.now();
			const filtered = await filterAsync(arr, filter, ConcurrencyType.SEQUENTIAL);
			const stop = Date.now();

			expect(stop - start).to.be.at.least(arr.length * 10);
			expect(stop - start).to.be.at.most(arr.length * 10 + 50);
			expect(filtered).toStrictEqual([2, 4]);
		});

		it('fails to filter when unsupported concurrency is given', async () => {
			const arr = new Array<number>();
			const filter = () => Promise.resolve(true);
			const concurrency = ConcurrencyType.BATCH;

			await expect(filterAsync(arr, filter, concurrency)).rejects.toThrow(`Can't handle given concurrency ${concurrency}.`);
		});
	});
});

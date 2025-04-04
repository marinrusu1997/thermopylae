import type { Comparator, Undefinable } from '@thermopylae/core.declarations';
import cryptoRandomString from 'crypto-random-string';
import { randomInt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Heap } from '../lib/index.js';

type ArrayComparator<T> = (a: Undefinable<T>, b: Undefinable<T>) => number;

interface TestHeapItemObject {
	x: number;
}
const ascendantNumberComparator = (a: number, b: number): number => a - b;
const ascendantStringComparator = (a: string, b: string): number => a.localeCompare(b);
const ascendantObjectComparator = (a: TestHeapItemObject, b: TestHeapItemObject): number => a.x - b.x;

describe(`${Heap.name} spec`, () => {
	function assertHeapSortedOrder<T>(heap: Heap<T>, comparator?: Comparator<T>): void {
		const sorted = [];
		while (!heap.empty) {
			sorted.push(heap.pop());
		}

		expect([...sorted].sort(comparator as ArrayComparator<T>)).toStrictEqual(sorted);
	}

	describe(`${Heap.prototype.push.name} & ${Heap.prototype.pop.name} spec`, () => {
		it('should sort an array using push and pop', () => {
			const heap = new Heap<number>();

			for (let i = 0; i < 100; i++) {
				heap.push(Math.random());
			}

			heap.push(2);
			heap.push(2);

			assertHeapSortedOrder(heap.clone());
		});

		it('should sort an array of numbers using push and pop (random order)', () => {
			const MAX_ITEMS = 100;
			const heap = new Heap<number>(ascendantNumberComparator);

			for (let i = 0; i < MAX_ITEMS; i++) {
				heap.push(randomInt(i, MAX_ITEMS));
			}

			assertHeapSortedOrder(heap.clone(), ascendantNumberComparator);
		});

		it('should sort an array of strings using push and pop (random order)', () => {
			const MAX_ITEMS = 500;
			const heap = new Heap<string>(ascendantStringComparator);

			for (let i = 0; i < MAX_ITEMS; i++) {
				heap.push(cryptoRandomString({ length: i }));
			}

			assertHeapSortedOrder(heap.clone(), ascendantStringComparator);
		});

		it('should sort an array of objects using push and pop (random order)', () => {
			const MAX_ITEMS = 500;
			const heap = new Heap<TestHeapItemObject>(ascendantObjectComparator);

			for (let i = 0; i < MAX_ITEMS; i++) {
				heap.push({ x: randomInt(i, MAX_ITEMS) });
			}

			assertHeapSortedOrder(heap, ascendantObjectComparator);
		});

		it('should work with custom comparison function', () => {
			const heap = new Heap<number>((a: number, b: number) => {
				if (a > b) {
					return -1;
				}

				if (a < b) {
					return 1;
				}

				return 0;
			});

			for (let i = 0; i < 10; i++) {
				heap.push(Math.random());
			}

			const sorted = [];
			while (!heap.empty) {
				sorted.push(heap.pop());
			}

			expect([...sorted].sort().reverse()).toStrictEqual(sorted);
		});
	});

	describe(`${Heap.prototype.replaceRootWith.name} spec`, () => {
		it('should behave like pop() followed by push()', () => {
			const heap = new Heap<number>();

			for (let i = 1; i <= 5; i++) {
				heap.push(i);
			}

			expect(heap.replaceRootWith(3)).to.be.eq(1);

			expect(heap.toArray().sort()).toStrictEqual([2, 3, 3, 4, 5]);
		});
	});

	describe(`${Heap.prototype.contains.name} spec`, () => {
		it('should return whether it contains the value', () => {
			const heap = new Heap();
			for (let i = 1; i < 5; i++) {
				heap.push(i);
			}

			for (let i = 1; i < 5; i++) {
				expect(heap.contains(i)).to.be.eq(true);
			}

			for (let i = 1; i < 5; i++) {
				expect(heap.contains((item) => item === i)).to.be.eq(true);
			}

			expect(heap.contains(0)).to.be.eq(false);
			expect(heap.contains((item) => item === 6)).to.be.eq(false);
		});
	});

	describe(`${Heap.prototype.peek.name} spec`, () => {
		it('should return the top value', () => {
			const heap = new Heap();
			heap.push(1);
			expect(heap.peek()).to.be.eql(1);
			heap.push(2);
			expect(heap.peek()).to.be.eql(1);
			heap.pop();
			expect(heap.peek()).to.be.eql(2);
		});
	});

	describe(`${Heap.prototype.clone.name} spec`, () => {
		it('should return a cloned heap', () => {
			const a = { x: 1 };
			const b = { x: 2 };
			const c = { x: 3 };

			const original = new Heap<TestHeapItemObject>(ascendantObjectComparator);

			original.push(a);
			original.push(b);
			original.push(c);

			const clone = original.clone();
			expect(original.toArray()).toStrictEqual(clone.toArray());

			assertHeapSortedOrder(original, ascendantObjectComparator);
			assertHeapSortedOrder(clone, ascendantObjectComparator);
		});
	});

	describe(`${Heap.prototype.update.name} spec`, () => {
		it('should update item and preserve order', () => {
			const a: TestHeapItemObject = { x: 1 };
			const b: TestHeapItemObject = { x: 2 };
			const c: TestHeapItemObject = { x: 3 };

			const heap = new Heap<TestHeapItemObject>(ascendantObjectComparator);
			heap.push(a);
			heap.push(b);
			heap.push(c);

			const index = heap.findIndex((val) => val.x === 3);
			heap.update(index, { x: 0 });

			expect(heap.pop()?.x).to.be.eq(0);
		});

		it('should not update item if it was not found', () => {
			const heap = new Heap();

			for (let i = 5; i >= 1; i--) {
				heap.push(i);
			}

			// oxlint-disable-next-line prefer-array-index-of
			const index = heap.findIndex((val) => val === 0);

			let err: Error | null = null;
			try {
				heap.update(index, 0);
			} catch (error) {
				err = error;
			}
			expect(err)
				.to.be.instanceOf(Error)
				.and.to.haveOwnProperty('message', `Invalid index. Provided index ${index} should be in the range 0-${heap.size - 1}. `);

			assertHeapSortedOrder(heap);
		});
	});

	describe(`${Heap.prototype.remove.name} spec`, () => {
		it('should remove top of the heap', () => {
			const a: TestHeapItemObject = { x: 1 };
			const b: TestHeapItemObject = { x: 2 };
			const c: TestHeapItemObject = { x: 3 };

			const heap = new Heap<TestHeapItemObject>(ascendantObjectComparator);
			heap.push(a);
			heap.push(b);
			heap.push(c);

			const index = heap.findIndex((val) => val.x === 1);
			heap.remove(index);

			expect(heap.peek()?.x).to.be.eq(2);
			assertHeapSortedOrder(heap);
		});

		it('should remove bottom of the heap', () => {
			const a: TestHeapItemObject = { x: 1 };
			const b: TestHeapItemObject = { x: 2 };
			const c: TestHeapItemObject = { x: 3 };

			const heap = new Heap<TestHeapItemObject>(ascendantObjectComparator);
			heap.push(a);
			heap.push(b);
			heap.push(c);

			const index = heap.findIndex((val) => val.x === 3);
			heap.remove(index);

			expect(heap.peek()?.x).to.be.eq(1);
			assertHeapSortedOrder(heap);
		});

		it('should remove middle of the heap', () => {
			const a: TestHeapItemObject = { x: 1 };
			const b: TestHeapItemObject = { x: 2 };
			const c: TestHeapItemObject = { x: 3 };

			const heap = new Heap<TestHeapItemObject>(ascendantObjectComparator);
			heap.push(a);
			heap.push(b);
			heap.push(c);

			const index = heap.findIndex((val) => val.x === 2);
			heap.remove(index);

			expect(heap.peek()?.x).to.be.eq(1);
			assertHeapSortedOrder(heap);
		});

		it('should remove item and preserve order', () => {
			expect.hasAssertions();

			const MAX_ITEMS = 100;
			const items = Array.from({ length: MAX_ITEMS }, (_, i) => randomInt(i, MAX_ITEMS));

			const heap = new Heap<number>(ascendantNumberComparator);
			for (const item of items) {
				heap.push(item);
			}

			while (items.length > 0) {
				const itemsIndex = randomInt(0, items.length);
				// oxlint-disable-next-line prefer-array-index-of
				const heapIndex = heap.findIndex((n) => n === items[itemsIndex]);

				heap.remove(heapIndex);
				items.splice(itemsIndex, 1);

				assertHeapSortedOrder(heap.clone(), ascendantNumberComparator);
			}
		});

		it('fails to remove unknown index', () => {
			const heap = new Heap<number>(ascendantNumberComparator);

			const index = -1;

			let err: Error | null = null;
			try {
				heap.remove(index);
			} catch (error) {
				err = error;
			}

			expect(err)
				.to.be.instanceOf(Error)
				.and.to.haveOwnProperty('message', `Invalid index. Provided index ${index} should be in the range 0-${heap.size - 1}. `);
		});
	});

	describe(`${Heap.prototype.clear.name} spec`, () => {
		it('should clear heap', () => {
			const heap = new Heap();

			for (let i = 5; i >= 1; i--) {
				heap.push(i);
			}

			expect(heap.size).to.be.eq(5);

			heap.clear();

			for (let i = 5; i >= 1; i--) {
				heap.push(i);
			}

			const expectedSorted = [];
			while (!heap.empty) {
				expectedSorted.push(heap.pop());
			}

			expect(expectedSorted).toStrictEqual([1, 2, 3, 4, 5]);
			expect(heap.size).to.be.eq(0);
		});
	});
});

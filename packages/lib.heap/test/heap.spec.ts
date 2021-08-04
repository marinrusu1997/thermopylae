import { describe, it } from 'mocha';
import { chai } from '@thermopylae/dev.unit-test';
import { number, string } from '@thermopylae/lib.utils';
import { Comparator, Undefinable } from '@thermopylae/core.declarations';
import { Heap } from '../lib';

const { expect } = chai;

type ArrayComparator<T> = (a: Undefinable<T>, b: Undefinable<T>) => number;

describe(`${Heap.name} spec`, () => {
	function assertHeapSortedOrder<T>(heap: Heap<T>, comparator?: Comparator<T>): void {
		const sorted = [];
		while (!heap.empty) {
			sorted.push(heap.pop());
		}

		expect(sorted.slice().sort(comparator as ArrayComparator<T>)).to.be.equalTo(sorted);
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

			const comparator = (a: number, b: number): number => a - b;
			const heap = new Heap<number>(comparator);

			for (let i = 0; i < MAX_ITEMS; i++) {
				heap.push(number.randomInt(i, MAX_ITEMS));
			}

			assertHeapSortedOrder(heap.clone(), comparator);
		});

		it('should sort an array of strings using push and pop (random order)', () => {
			const MAX_ITEMS = 500;

			const comparator = (a: string, b: string): number => a.localeCompare(b);
			const heap = new Heap<string>(comparator);

			for (let i = 0; i < MAX_ITEMS; i++) {
				heap.push(string.random({ length: i }));
			}

			assertHeapSortedOrder(heap.clone(), comparator);
		});

		it('should sort an array of objects using push and pop (random order)', () => {
			const MAX_ITEMS = 500;

			const comparator = (a: any, b: any): number => a.x - b.x;
			const heap = new Heap<{ x: number }>(comparator);

			for (let i = 0; i < MAX_ITEMS; i++) {
				heap.push({ x: number.randomInt(i, MAX_ITEMS) });
			}

			assertHeapSortedOrder(heap, comparator);
		});

		it('should work with custom comparison function', () => {
			const comparator = (a: number, b: number) => {
				if (a > b) {
					return -1;
				}

				if (a < b) {
					return 1;
				}

				return 0;
			};

			const heap = new Heap<number>(comparator);

			for (let i = 0; i < 10; i++) {
				heap.push(Math.random());
			}

			const sorted = [];
			while (!heap.empty) {
				sorted.push(heap.pop());
			}

			expect(sorted.slice().sort().reverse()).to.be.equalTo(sorted);
		});
	});

	describe(`${Heap.prototype.replaceRootWith.name} spec`, () => {
		it('should behave like pop() followed by push()', () => {
			const heap = new Heap<number>();

			for (let i = 1; i <= 5; i++) {
				heap.push(i);
			}

			expect(heap.replaceRootWith(3)).to.be.eq(1);

			expect(heap.toArray().sort()).to.be.equalTo([2, 3, 3, 4, 5]);
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

			const comparator = (x: any, y: any): number => x.x - y.x;
			const original = new Heap<{ x: number }>(comparator);

			original.push(a);
			original.push(b);
			original.push(c);

			const clone = original.clone();
			expect(original.toArray()).to.be.equalTo(clone.toArray());

			assertHeapSortedOrder(original, comparator);
			assertHeapSortedOrder(clone, comparator);
		});
	});

	describe(`${Heap.prototype.update.name} spec`, () => {
		it('should update item and preserve order', () => {
			const a = { x: 1 };
			const b = { x: 2 };
			const c = { x: 3 };

			const heap = new Heap<{ x: number }>((m, n) => m.x - n.x);
			heap.push(a);
			heap.push(b);
			heap.push(c);

			const index = heap.findIndex((val) => val.x === 3);
			heap.update(index, { x: 0 });

			expect(heap.pop()!.x).to.be.eq(0);
		});

		it('should not update item if it was not found', () => {
			const heap = new Heap();

			for (let i = 5; i >= 1; i--) {
				heap.push(i);
			}

			const index = heap.findIndex((val) => val === 0);

			let err: Error | null = null;
			try {
				heap.update(index, 0);
			} catch (e) {
				err = e;
			}
			expect(err)
				.to.be.instanceOf(Error)
				.and.to.haveOwnProperty('message', `Invalid index. Provided index ${index} should be in the range 0-${heap.size - 1}. `);

			assertHeapSortedOrder(heap);
		});
	});

	describe(`${Heap.prototype.remove.name} spec`, () => {
		it('should remove top of the heap', () => {
			const a = { x: 1 };
			const b = { x: 2 };
			const c = { x: 3 };

			const heap = new Heap<{ x: number }>((m, n) => m.x - n.x);
			heap.push(a);
			heap.push(b);
			heap.push(c);

			const index = heap.findIndex((val) => val.x === 1);
			heap.remove(index);

			expect(heap.peek()!.x).to.be.eq(2);
			assertHeapSortedOrder(heap);
		});

		it('should remove bottom of the heap', () => {
			const a = { x: 1 };
			const b = { x: 2 };
			const c = { x: 3 };

			const heap = new Heap<{ x: number }>((m, n) => m.x - n.x);
			heap.push(a);
			heap.push(b);
			heap.push(c);

			const index = heap.findIndex((val) => val.x === 3);
			heap.remove(index);

			expect(heap.peek()!.x).to.be.eq(1);
			assertHeapSortedOrder(heap);
		});

		it('should remove middle of the heap', () => {
			const a = { x: 1 };
			const b = { x: 2 };
			const c = { x: 3 };

			const heap = new Heap<{ x: number }>((m, n) => m.x - n.x);
			heap.push(a);
			heap.push(b);
			heap.push(c);

			const index = heap.findIndex((val) => val.x === 2);
			heap.remove(index);

			expect(heap.peek()!.x).to.be.eq(1);
			assertHeapSortedOrder(heap);
		});

		it('should remove item and preserve order', () => {
			const MAX_ITEMS = 100;

			const items: Array<number> = new Array<number>(MAX_ITEMS);

			const comparator = (m: number, n: number): number => m - n;
			const heap = new Heap<number>(comparator);

			let generated;
			for (let i = 0; i < MAX_ITEMS; i++) {
				generated = number.randomInt(i, MAX_ITEMS);
				items[i] = generated;
				heap.push(generated);
			}

			while (items.length) {
				const itemsIndex = number.randomInt(0, items.length - 1);
				const heapIndex = heap.findIndex((n) => n === items[itemsIndex]);

				heap.remove(heapIndex);
				items.splice(itemsIndex, 1);

				assertHeapSortedOrder(heap.clone(), comparator);
			}
		});

		it('fails to remove unknown index', () => {
			const comparator = (m: number, n: number): number => m - n;
			const heap = new Heap<number>(comparator);

			const index = -1;

			let err;
			try {
				heap.remove(index);
			} catch (e) {
				err = e;
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

			expect(expectedSorted).to.be.equalTo([1, 2, 3, 4, 5]);
			expect(heap.size).to.be.eq(0);
		});
	});
});

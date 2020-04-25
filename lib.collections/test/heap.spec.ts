import { describe, it } from 'mocha';
import { chai } from './chai';
import { Heap } from '../lib';

const { expect } = chai;

describe('Heap spec', () => {
	function assertHeapSortedOrder<T>(heap: Heap<T>): void {
		const sorted = [];
		while (!heap.empty()) {
			sorted.push(heap.pop());
		}

		expect(sorted.slice().sort()).to.be.equalTo(sorted);
	}

	describe('push, pop spec', () => {
		it('should sort an array using push and pop', () => {
			const heap = new Heap<number>();

			for (let i = 0; i < 10; i++) {
				heap.push(Math.random());
			}

			heap.push(2);
			heap.push(2);

			assertHeapSortedOrder(heap);
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
			while (!heap.empty()) {
				sorted.push(heap.pop());
			}

			expect(
				sorted
					.slice()
					.sort()
					.reverse()
			).to.be.equalTo(sorted);
		});
	});

	describe('replace spec', () => {
		it('should behave like pop() followed by push()', () => {
			const heap = new Heap<number>();

			for (let i = 1; i <= 5; i++) {
				heap.push(i);
			}

			expect(heap.replace(3)).to.be.eq(1);

			expect(heap.toArray().sort()).to.be.equalTo([2, 3, 3, 4, 5]);
		});
	});

	describe('pushPop spec', () => {
		it('should behave like push() followed by pop()', () => {
			const heap = new Heap();
			for (let i = 1; i <= 5; i++) {
				heap.push(i);
			}

			expect(heap.pushPop(6)).to.be.eq(1);

			const expectArr = [];
			for (let i = 2; i <= 6; i++) {
				expectArr.push(i);
			}

			expect(heap.toArray().sort()).to.be.equalTo(expectArr);
		});
	});

	describe('contains spec', () => {
		it('should return whether it contains the value', () => {
			const heap = new Heap();
			for (let i = 1; i < 5; i++) {
				heap.push(i);
			}

			for (let i = 1; i < 5; i++) {
				expect(heap.contains(i)).to.be.eq(true);
			}

			for (let i = 1; i < 5; i++) {
				expect(heap.contains(item => item === i)).to.be.eq(true);
			}

			expect(heap.contains(0)).to.be.eq(false);
			expect(heap.contains(item => item === 6)).to.be.eq(false);
		});
	});

	describe('peek spec', () => {
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

	describe('clone', () => {
		it('should return a cloned heap', () => {
			const heap1 = new Heap();

			for (let i = 1; i < 5; i++) {
				heap1.push(i);
			}

			const heap2 = heap1.clone();
			expect(heap1.toArray()).to.be.equalTo(heap2.toArray());
		});
	});

	describe('updateItem spec', () => {
		it('should return correct order', () => {
			const a = { x: 1 };
			const b = { x: 2 };
			const c = { x: 3 };

			const heap = new Heap<{ x: number }>((m, n) => m.x - n.x);
			heap.push(a);
			heap.push(b);
			heap.push(c);

			expect(heap.updateItem({ x: 0 }, val => val.x === 3)).to.be.deep.eq(a);

			expect(heap.pop().x).to.be.eq(0);
		});

		it('should not update item if it was not found', () => {
			const heap = new Heap();

			for (let i = 5; i >= 1; i--) {
				heap.push(i);
			}

			expect(heap.updateItem(0, val => val === 0)).to.be.eq(undefined);

			const expectedSorted = [];
			while (!heap.empty()) {
				expectedSorted.push(heap.pop());
			}

			expect(expectedSorted).to.be.equalTo([1, 2, 3, 4, 5]);
			expect(heap.size()).to.be.eq(0);
		});
	});

	describe('clear spec', () => {
		it('should clear heap', () => {
			const heap = new Heap();

			for (let i = 5; i >= 1; i--) {
				heap.push(i);
			}

			expect(heap.size()).to.be.eq(5);

			heap.clear();

			for (let i = 5; i >= 1; i--) {
				heap.push(i);
			}

			const expectedSorted = [];
			while (!heap.empty()) {
				expectedSorted.push(heap.pop());
			}

			expect(expectedSorted).to.be.equalTo([1, 2, 3, 4, 5]);
			expect(heap.size()).to.be.eq(0);
		});
	});
});

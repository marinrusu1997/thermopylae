import type { Comparator } from '@thermopylae/core.declarations';
import { logger } from '@thermopylae/dev.unit-test';
import type { types } from '@thermopylae/lib.utils';
import colors from 'colors';
import { randomInt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { HEAP_NODE_IDX_SYM, Heap, type HeapNode } from '../../lib/data-structures/heap.js';

interface HeapDataNode extends HeapNode {
	data: number;
}

const comparator: Comparator<HeapDataNode> = (first, second) => second.data - first.data;

function buildNode(data: number): HeapDataNode {
	return { data, [HEAP_NODE_IDX_SYM]: -1 };
}

function randomDifferentFrom(num: number): number {
	let generated: number | null = null;
	while ((generated = randomInt(0, 100)) === num) {
		continue;
	}
	return generated;
}

function assertHeapProperties(heap: Heap<HeapDataNode>, sortedArr?: readonly number[]) {
	const heapNumbers = [];
	while (heap.size > 0) {
		const node = heap.pop() ?? ({} as types.Any);
		expect(node[HEAP_NODE_IDX_SYM]).toBeUndefined(); // it was detached
		heapNumbers.push(node.data);
	}

	if (sortedArr) {
		expect(heapNumbers).to.have.length(sortedArr.length);
		expect(heapNumbers).toStrictEqual(sortedArr);
	} else {
		expect(heapNumbers).toStrictEqual(heapNumbers.toSorted());
	}
}

describe(`${colors.magenta(Heap.name)} spec`, () => {
	describe(`${Heap.prototype.push.name.magenta} & ${Heap.prototype.pop.name.magenta} spec`, () => {
		it('should build a simple heap', () => {
			const heap = new Heap<HeapDataNode>(comparator);
			const numbers = Object.freeze([7, 2, 100, 25, 1, 19, 36, 3, 17]);
			const sortedNumbers = Object.freeze([100, 36, 25, 19, 17, 7, 3, 2, 1]);

			for (let i = numbers.length - 1; i >= 0; i--) {
				heap.push(buildNode(numbers[i]));
			}

			assertHeapProperties(heap, sortedNumbers);
		});
	});

	describe(`${Heap.prototype.delete.name.magenta} spec`, () => {
		it('should delete arbitrary nodes', () => {
			expect.hasAssertions();

			const CAPACITY = randomInt(1, 20);
			const ELEMENTS = Array.from({ length: CAPACITY }, () => buildNode(randomInt(0, 100)));
			const TO_BE_DELETED = ELEMENTS.filter((_, index) => index % 3 === 0); // delete 1/3 of nodes
			const REMAINED_SORTED_ELEMENTS = ELEMENTS.filter((element) => !TO_BE_DELETED.includes(element))
				.map((element) => element.data)
				.sort((a, b) => b - a);

			try {
				const heap = new Heap<HeapDataNode>(comparator);
				for (let i = 0; i < CAPACITY; i++) {
					heap.push(ELEMENTS[i]);
				}
				for (const toBeDeleted of TO_BE_DELETED) {
					heap.delete(toBeDeleted);
					expect(toBeDeleted[HEAP_NODE_IDX_SYM]).toBeUndefined();
				}

				assertHeapProperties(heap, REMAINED_SORTED_ELEMENTS);
			} catch (error) {
				const message = [
					'Test Context:',
					`${'CAPACITY'.magenta}\t\t\t\t: ${CAPACITY}`,
					'\n',
					`${'ELEMENTS'.magenta}\t\t\t\t: ${JSON.stringify(ELEMENTS)}`,
					`${'TO_BE_DELETED'.magenta}\t\t: ${JSON.stringify(TO_BE_DELETED)}`,
					'\n',
					`${'REMAINED_SORTED_ELEMENTS'.magenta}\t: ${JSON.stringify(REMAINED_SORTED_ELEMENTS)}`
				];

				logger.info(message.join('\n'));
				throw error;
			}
		});
	});

	describe(`${Heap.prototype.heapifyUpdatedNode.name.magenta} spec`, () => {
		it('should replace arbitrary nodes', () => {
			expect.hasAssertions();

			const CAPACITY = randomInt(1, 20);
			const ELEMENTS = Array.from({ length: CAPACITY }, () => buildNode(randomInt(0, 100)));
			const TO_BE_HEAPIFIED = ELEMENTS.filter((_, index) => index % 3 === 0) // replace 1/3 of nodes
				.map((element) => [element, buildNode(randomDifferentFrom(element.data))]);
			const SORTED_ELEMENTS_AFTER_REPLACE = ELEMENTS.map((element) => {
				for (const toBeHeapified of TO_BE_HEAPIFIED) {
					if (toBeHeapified[0] === element) {
						return toBeHeapified[1].data; // return the replacement
					}
				}
				return element.data; // not being replaced, return his data
			}).sort((a, b) => b - a);

			try {
				const heap = new Heap<HeapDataNode>(comparator);
				for (let i = 0; i < CAPACITY; i++) {
					heap.push(ELEMENTS[i]);
				}
				for (const toBeHeapified of TO_BE_HEAPIFIED) {
					toBeHeapified[0].data = toBeHeapified[1].data;
					heap.heapifyUpdatedNode(toBeHeapified[0]);
					expect(toBeHeapified[0][HEAP_NODE_IDX_SYM]).toBeDefined();
				}

				assertHeapProperties(heap, SORTED_ELEMENTS_AFTER_REPLACE);
			} catch (error) {
				const message = [
					'Test Context:',
					`${'CAPACITY'.magenta}\t\t\t\t: ${CAPACITY}`,
					'\n',
					`${'ELEMENTS'.magenta}\t\t\t\t: ${JSON.stringify(ELEMENTS)}`,
					`${'TO_BE_HEAPIFIED'.magenta}\t\t: ${JSON.stringify(TO_BE_HEAPIFIED)}`,
					'\n',
					`${'SORTED_ELEMENTS_AFTER_REPLACE'.magenta}: ${JSON.stringify(SORTED_ELEMENTS_AFTER_REPLACE)}`
				];

				logger.info(message.join('\n'));
				throw error;
			}
		});
	});

	describe(`${Heap.prototype.clear.name.magenta} spec`, () => {
		it('clears heap', () => {
			const heap = new Heap<HeapDataNode>(comparator);
			heap.push(buildNode(2));
			heap.push(buildNode(3));
			heap.push(buildNode(1));
			expect(heap.size).to.be.eq(3);

			heap.clear();
			expect(heap.size).to.be.eq(0);
		});
	});
});

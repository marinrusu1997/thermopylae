import isFunction from 'lodash.isfunction';
import { defaultCompare, CompareFunction, ArrayEqualsPredicate } from './utils';

// Original implementation can be found here: https://github.com/qiao/heap.js/blob/master/lib/heap.js

/**
 * Binary heap.
 */
class Heap<T = number> {
	private readonly compare: CompareFunction<T>;

	private readonly nodes: Array<T>;

	constructor(comparator?: CompareFunction<T>) {
		this.compare = comparator || defaultCompare;
		this.nodes = [];
	}

	public peek(): T | undefined {
		return this.nodes[0];
	}

	public push(item: T): void {
		this.nodes.push(item);
		this.siftDown(0, this.nodes.length - 1);
	}

	public pop(): T {
		const lastEl = this.nodes.pop();
		let returnItem: T;

		if (this.nodes.length) {
			[returnItem] = this.nodes;
			this.nodes[0] = lastEl!;
			this.siftUp(0);
		} else {
			returnItem = lastEl!;
		}

		return returnItem;
	}

	public pushPop(item: T): T {
		let ref;

		if (this.nodes.length && this.compare(this.nodes[0], item) < 0) {
			ref = [this.nodes[0], item];
			[item] = ref;
			// eslint-disable-next-line prefer-destructuring
			this.nodes[0] = ref[1];
			this.siftUp(0);
		}

		return item;
	}

	public replace(item: T): T {
		const returnItem = this.nodes[0];
		this.nodes[0] = item;
		this.siftUp(0);

		return returnItem;
	}

	public findIndex(equalsFunction: ArrayEqualsPredicate<T>): number {
		return this.nodes.findIndex(equalsFunction);
	}

	public update(index: number, newItem: T): void {
		Heap.assertIndex(index, this.nodes.length);

		this.nodes[index] = newItem;

		this.siftDown(0, index);
		this.siftUp(index);
	}

	public remove(index: number): void {
		Heap.assertIndex(index, this.nodes.length);

		if (index === this.nodes.length - 1) {
			this.nodes.length -= 1;
			return;
		}

		this.nodes[index] = this.nodes[this.nodes.length - 1];
		this.nodes.length -= 1;

		if (this.heapify(index) === index) {
			this.propagateUp(index);
		}
	}

	public contains(itemOrPredicate: ArrayEqualsPredicate<T> | T): boolean {
		// @ts-ignore
		const pos = isFunction(itemOrPredicate) ? this.nodes.findIndex(itemOrPredicate) : this.nodes.indexOf(itemOrPredicate);
		return pos !== -1;
	}

	public empty(): boolean {
		return this.nodes.length === 0;
	}

	public size(): number {
		return this.nodes.length;
	}

	public clear(): void {
		this.nodes.length = 0;
	}

	public toArray(): Array<T> {
		return this.nodes.slice(0);
	}

	public clone(): Heap<T> {
		const heap = new Heap<T>(this.compare);
		for (const item of this.nodes) {
			heap.nodes.push(item);
		}
		return heap;
	}

	private swap(indexA: number, indexB: number): void {
		const aux = this.nodes[indexA];
		this.nodes[indexA] = this.nodes[indexB];
		this.nodes[indexB] = aux;
	}

	private heapify(index: number): number {
		let left = 2 * index + 1;
		let right;

		let largest = index;
		while (left < this.nodes.length) {
			right = left + 1;

			if (this.compare(this.nodes[left], this.nodes[largest]) < 0) {
				largest = left;
			}

			if (right < this.nodes.length && this.compare(this.nodes[right], this.nodes[largest]) < 0) {
				largest = right;
			}

			if (largest === index) {
				return index;
			}

			this.swap(index, largest);

			index = largest;
			left = 2 * index + 1;
		}

		return index;
	}

	private propagateUp(index: number): void {
		let parent;
		while (index) {
			parent = Math.floor((index - 1) / 2);
			if (this.compare(this.nodes[index], this.nodes[parent]) < 0) {
				this.swap(index, parent);
				index = parent;
			} else {
				return;
			}
		}
	}

	private siftUp(pos: number): T {
		const endPos = this.nodes.length;
		const startPos = pos;
		const newItem = this.nodes[pos];
		let leftPos = 2 * pos + 1;
		let rightPos;

		while (leftPos < endPos) {
			rightPos = leftPos + 1;

			if (rightPos < endPos && !(this.compare(this.nodes[leftPos], this.nodes[rightPos]) < 0)) {
				leftPos = rightPos;
			}

			this.nodes[pos] = this.nodes[leftPos];
			pos = leftPos;
			leftPos = 2 * pos + 1;
		}

		this.nodes[pos] = newItem;

		return this.siftDown(startPos, pos);
	}

	private siftDown(startPos: number, pos: number): T {
		const newItem = this.nodes[pos];
		let parent: T;
		let parentPos: number;

		while (pos > startPos) {
			// eslint-disable-next-line no-bitwise
			parentPos = (pos - 1) >> 1;
			parent = this.nodes[parentPos];

			if (this.compare(newItem, parent) < 0) {
				this.nodes[pos] = parent;
				pos = parentPos;
				continue;
			}

			break;
		}

		this.nodes[pos] = newItem;

		return newItem;
	}

	private static assertIndex(index: number, length: number): void {
		if (index < 0 || index > length - 1) {
			throw new Error(`Invalid index. Provided index ${index} should be in the range 0-${length - 1}. `);
		}
	}
}

export { Heap };

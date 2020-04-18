// @ts-ignore
import isFunction from 'lodash.isfunction';
import { defaultCompare, CompareFunction, ArrayEqualsPredicate } from './commons';

/**
 * Binary min heap.
 * Original implementation can be found here: https://github.com/qiao/heap.js/blob/master/lib/heap.js
 */
class Heap<T = number> {
	private readonly compare: CompareFunction<T>;

	private readonly nodes: Array<T>;

	constructor(comparator?: CompareFunction<T>) {
		this.compare = comparator || defaultCompare;
		this.nodes = [];
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

	public peek(): T | undefined {
		return this.nodes[0];
	}

	public replace(item: T): T {
		const returnItem = this.nodes[0];
		this.nodes[0] = item;
		this.siftUp(0);

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

	public heapify(): void {
		const ref1 = (() => {
			const results1: Array<number> = [];
			// eslint-disable-next-line no-plusplus
			for (let j = 0, ref = Math.floor(this.nodes.length / 2); ref >= 0 ? j < ref : j > ref; ref >= 0 ? j++ : j--) {
				results1.push(j);
			}
			return results1;
		})().reverse();

		for (let i = 0, len = ref1.length; i < len; i++) {
			i = ref1[i];
			this.siftUp(i);
		}
	}

	public updateItem(newItem: T, equalsFunction: ArrayEqualsPredicate<T>): T | undefined {
		const pos = this.nodes.findIndex(equalsFunction);

		if (pos === -1) {
			return undefined;
		}

		this.nodes[pos] = newItem;

		this.siftDown(0, pos);
		return this.siftUp(pos);
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
		const heap = new Heap<T>();
		for (const item of this.nodes) {
			heap.nodes.push(item);
		}
		return heap;
	}

	private siftUp(pos: number): T {
		const endPos = this.nodes.length;
		const startPos = pos;
		const newItem = this.nodes[pos];
		let childPos = 2 * pos + 1;
		let rightPos;

		while (childPos < endPos) {
			rightPos = childPos + 1;

			if (rightPos < endPos && !(this.compare(this.nodes[childPos], this.nodes[rightPos]) < 0)) {
				childPos = rightPos;
			}

			this.nodes[pos] = this.nodes[childPos];
			pos = childPos;
			childPos = 2 * pos + 1;
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
}

export { Heap };

import type { Nullable } from '@thermopylae/core.declarations';
import { types } from '@thermopylae/lib.utils';
import type { LinkedList } from './interface.js';

/** @private */
const NEXT_SYM = Symbol('NEXT_SYM_SLL');

/** @private */
interface SingleLinkedListNode<Node> {
	[NEXT_SYM]: Nullable<Node>;
}

/** @private */
class SingleLinkedListIterator<Node extends SingleLinkedListNode<Node>> implements Iterator<Node, Node> {
	private node: Nullable<Node>;

	constructor(node: Nullable<Node>) {
		this.node = node;
	}

	public next(): IteratorResult<Node, Node> {
		if (this.node == null) {
			return { value: types.SOFT_DELETE, done: true };
		}

		const result: IteratorResult<Node, Node> = { value: this.node, done: false };
		this.node = this.node[NEXT_SYM];

		return result;
	}
}

/** @private */
// oxlint-disable-next-line max-classes-per-file
class SingleLinkedList<Node extends SingleLinkedListNode<Node>> implements LinkedList<SingleLinkedListNode<Node>> {
	public head: Nullable<Node>;

	public tail: Nullable<Node>;

	public size: number;

	public constructor(startNode: Nullable<Node> = null) {
		if (startNode == null) {
			this.size = 0;
		} else {
			startNode[NEXT_SYM] = null;
			this.size = 1;
		}

		this.head = startNode;
		this.tail = startNode;
	}

	public unshift(node: Node): void {
		node[NEXT_SYM] = this.head;
		this.head = node;

		if (this.tail == null) {
			this.tail = node;
		}

		this.size += 1;
	}

	public push(node: Node): void {
		node[NEXT_SYM] = null;

		if (this.tail == null) {
			this.head = node;
		} else {
			this.tail[NEXT_SYM] = node;
		}

		this.tail = node;
		this.size += 1;
	}

	public insertAfter(prevNode: Node, newNode: Node): void {
		newNode[NEXT_SYM] = prevNode[NEXT_SYM];
		prevNode[NEXT_SYM] = newNode;

		if (newNode[NEXT_SYM] == null) {
			this.tail = newNode;
		}

		this.size += 1;
	}

	public remove(node: Node): void {
		if (this.head === node) {
			this.head = node[NEXT_SYM];

			if (this.head == null) {
				this.tail = null; // last element was removed
			}
		} else {
			let current = (this.head && this.head[NEXT_SYM]) as Node; // there is at least two nodes
			let previous = this.head as Node;

			while (current !== node) {
				previous = current;
				current = current[NEXT_SYM] as Node;
			}

			previous[NEXT_SYM] = current[NEXT_SYM];

			if (this.tail === node) {
				this.tail = previous;
			}
		}

		node[NEXT_SYM] = null;
		this.size -= 1;
	}

	public toFront(node: Node): void {
		if (this.head === node) {
			return; // nothing to move, it's already in front
		}

		this.remove(node);
		this.unshift(node);
	}

	[Symbol.iterator](): Iterator<SingleLinkedListNode<Node>> {
		return new SingleLinkedListIterator<Node>(this.head);
	}

	public empty(): boolean {
		return this.size === 0;
	}

	public clear(): void {
		this.head = null;
		this.size = 0;
	}
}

export { SingleLinkedList, type SingleLinkedListNode, SingleLinkedListIterator, NEXT_SYM };

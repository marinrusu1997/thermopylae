/* eslint max-classes-per-file: 0 */ // --> OFF
import { Nullable } from '@thermopylae/core.declarations';
import { LinkedList } from './interface';

const NEXT_SYM = Symbol.for('NEXT_SYM_SLL');

interface SingleLinkedListNode<Node> {
	[NEXT_SYM]: Nullable<Node>;
}

class SingleLinkedListIterator<Node extends SingleLinkedListNode<Node>> implements Iterator<Node, Node> {
	private node: Nullable<Node>;

	constructor(node: Nullable<Node>) {
		this.node = node;
	}

	public next(): IteratorResult<Node, Node> {
		if (this.node == null) {
			return { value: null!, done: true };
		}

		const result: IteratorResult<Node, Node> = { value: this.node, done: false };
		this.node = this.node[NEXT_SYM];

		return result;
	}
}

class SingleLinkedList<Node extends SingleLinkedListNode<Node>> implements LinkedList<SingleLinkedListNode<Node>> {
	public head: Nullable<Node>;

	public tail: Nullable<Node>;

	public size: number;

	public constructor(startNode: Nullable<Node> = null) {
		if (startNode != null) {
			startNode[NEXT_SYM] = null;
			this.size = 1;
		} else {
			this.size = 0;
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
			let current: Node = this.head![NEXT_SYM]!; // there is at least two nodes
			let previous: Node = this.head!;

			while (current !== node) {
				previous = current;
				current = current[NEXT_SYM]!;
			}

			previous[NEXT_SYM] = current[NEXT_SYM];

			if (this.tail === node) {
				// @fixme O(n) -> Worst Case
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

export { SingleLinkedList, SingleLinkedListNode, SingleLinkedListIterator, NEXT_SYM };

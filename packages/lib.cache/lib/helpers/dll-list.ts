/* eslint max-classes-per-file: 0 */ // --> OFF
import { Nullable } from '@thermopylae/core.declarations';

const PREV_SYM = Symbol.for('PREV_SYM');
const NEXT_SYM = Symbol.for('NEXT_SYM');

interface DoublyLinkedListNode<Node> {
	[PREV_SYM]: Nullable<Node>;
	[NEXT_SYM]: Nullable<Node>;
}

class DoublyLinkedListIterator<Node extends DoublyLinkedListNode<Node>> implements Iterator<Node, Node> {
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

class DoublyLinkedList<Node extends DoublyLinkedListNode<Node>> implements Iterable<DoublyLinkedListNode<Node>> {
	public head: Nullable<Node>;

	public tail: Nullable<Node>;

	public constructor(startNode: Nullable<Node> = null) {
		if (startNode != null) {
			startNode[NEXT_SYM] = null;
			startNode[PREV_SYM] = null;
		}

		this.head = startNode;
		this.tail = startNode;
	}

	public get size(): number {
		let items = 0;
		for (const _ of this) {
			items += 1;
		}
		return items;
	}

	public addToFront(node: Node): void {
		node[NEXT_SYM] = this.head;
		node[PREV_SYM] = null;

		if (this.head !== null) {
			this.head[PREV_SYM] = node;
		} else {
			this.tail = node;
		}

		this.head = node;
	}

	public addToBack(node: Node): void {
		node[NEXT_SYM] = null;
		node[PREV_SYM] = this.tail;

		if (this.tail !== null) {
			this.tail[NEXT_SYM] = node;
		} else {
			this.head = node;
		}

		this.tail = node;
	}

	public appendAfter(prevNode: Node, newNode: Node): void {
		if (this.head === null) {
			this.head = newNode;
			this.tail = newNode;

			return;
		}

		newNode[NEXT_SYM] = prevNode[NEXT_SYM];
		prevNode[NEXT_SYM] = newNode;

		newNode[PREV_SYM] = prevNode;
		if (newNode[NEXT_SYM] !== null) {
			newNode[NEXT_SYM]![PREV_SYM] = newNode;
		} else {
			this.tail = newNode;
		}
	}

	public removeNode(node: Node): void {
		if (node[PREV_SYM] !== null) {
			node[PREV_SYM]![NEXT_SYM] = node[NEXT_SYM];
		} else {
			this.head = node[NEXT_SYM];
		}

		if (node[NEXT_SYM] !== null) {
			node[NEXT_SYM]![PREV_SYM] = node[PREV_SYM];
		} else {
			this.tail = node[PREV_SYM];
		}

		node[PREV_SYM] = null;
		node[NEXT_SYM] = null;
	}

	public moveToFront(node: Node): void {
		if (this.head === node) {
			return; // nothing to move, it's already in front
		}

		this.removeNode(node);
		this.addToFront(node);
	}

	[Symbol.iterator](): Iterator<DoublyLinkedListNode<Node>> {
		return new DoublyLinkedListIterator<Node>(this.head);
	}

	public empty(): boolean {
		return this.head == null;
	}

	public clear(): void {
		this.head = null;
		this.tail = null;
	}
}

export { DoublyLinkedList, DoublyLinkedListNode, DoublyLinkedListIterator, NEXT_SYM, PREV_SYM };

/* eslint max-classes-per-file: 0 */
// --> OFF
import type { Nullable } from '@thermopylae/core.declarations';
import type { LinkedList } from './interface.js';

/** @private */
const PREV_SYM = Symbol.for('PREV_SYM_DLL');
/** @private */
const NEXT_SYM = Symbol.for('NEXT_SYM_DLL');

/** @private */
interface DoublyLinkedListNode<Node> {
	[PREV_SYM]: Nullable<Node>;
	[NEXT_SYM]: Nullable<Node>;
}

/** @private */
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

/** @private */
class DoublyLinkedList<Node extends DoublyLinkedListNode<Node>> implements LinkedList<DoublyLinkedListNode<Node>> {
	public head: Nullable<Node>;

	public tail: Nullable<Node>;

	public size: number;

	public constructor(startNode: Nullable<Node> = null) {
		if (startNode != null) {
			startNode[NEXT_SYM] = null;
			startNode[PREV_SYM] = null;
			this.size = 1;
		} else {
			this.size = 0;
		}

		this.head = startNode;
		this.tail = startNode;
	}

	public unshift(node: Node): void {
		node[NEXT_SYM] = this.head;
		node[PREV_SYM] = null;

		if (this.head !== null) {
			this.head[PREV_SYM] = node;
		} else {
			this.tail = node;
		}

		this.head = node;
		this.size += 1;
	}

	public push(node: Node): void {
		node[NEXT_SYM] = null;
		node[PREV_SYM] = this.tail;

		if (this.tail !== null) {
			this.tail[NEXT_SYM] = node;
		} else {
			this.head = node;
		}

		this.tail = node;
		this.size += 1;
	}

	public insertAfter(prevNode: Node, newNode: Node): void {
		newNode[NEXT_SYM] = prevNode[NEXT_SYM];
		prevNode[NEXT_SYM] = newNode;

		newNode[PREV_SYM] = prevNode;
		if (newNode[NEXT_SYM] !== null) {
			newNode[NEXT_SYM]![PREV_SYM] = newNode;
		} else {
			this.tail = newNode;
		}

		this.size += 1;
	}

	public remove(node: Node): void {
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
		this.size -= 1;
	}

	public toFront(node: Node): void {
		this.remove(node);
		this.unshift(node);
	}

	public toTail(node: Node): void {
		this.remove(node);
		this.push(node);
	}

	[Symbol.iterator](): Iterator<Node> {
		return new DoublyLinkedListIterator<Node>(this.head);
	}

	public empty(): boolean {
		return this.size === 0;
	}

	public clear(): void {
		this.head = null;
		this.tail = null;
		this.size = 0;
	}
}

export { DoublyLinkedList, type DoublyLinkedListNode, DoublyLinkedListIterator, NEXT_SYM, PREV_SYM };

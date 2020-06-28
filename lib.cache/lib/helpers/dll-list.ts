/* eslint max-classes-per-file: 0 */ // --> OFF

// FIXME TEST FOR MEMORY LEAKS
// FIXME UNIT TESTS

const PREV_SYM = Symbol.for('PREV_SYM');
const NEXT_SYM = Symbol.for('NEXT_SYM');

// eslint-disable-next-line max-classes-per-file
interface DoublyLinkedListNode<Node> {
	[PREV_SYM]: Node | null;
	[NEXT_SYM]: Node | null;
}

class DoublyLinkedListIterator<Node extends DoublyLinkedListNode<Node>> implements Iterator<Node, Node> {
	private node: Node | null;

	constructor(node: Node | null) {
		this.node = node;
	}

	public next(): IteratorResult<Node, Node> {
		// fixme test all nodes are iterated

		if (this.node === null) {
			return { value: null!, done: true };
		}

		const result: IteratorResult<Node, Node> = { value: this.node, done: false };
		this.node = this.node[NEXT_SYM];

		return result;
	}
}

class DoublyLinkedList<Node extends DoublyLinkedListNode<Node>> {
	public head: Node | null;

	public tail: Node | null;

	constructor(startNode: Node | null = null) {
		this.head = startNode;
		this.tail = startNode;
	}

	public addToFront(node: Node): void {
		node[NEXT_SYM] = this.head;
		node[PREV_SYM] = null;

		if (this.head !== null) {
			this.head[PREV_SYM] = node;
		}
		this.head = node;

		if (this.tail === null) {
			this.tail = node;
		}
	}

	public appendAfter(prevNode: Node, newNode: Node): void {
		if (this.empty()) {
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
		const prevNode = node[PREV_SYM];
		const nextNode = node[NEXT_SYM];

		if (prevNode !== null) {
			prevNode[NEXT_SYM] = nextNode;
		} else {
			this.head = nextNode;
		}

		if (nextNode !== null) {
			nextNode[PREV_SYM] = prevNode;
		} else {
			this.tail = prevNode;
		}
	}

	public moveToFront(node: Node): void {
		this.removeNode(node);
		this.addToFront(node);
	}

	public iterator(): DoublyLinkedListIterator<Node> {
		return new DoublyLinkedListIterator<Node>(this.head);
	}

	public empty(): boolean {
		return this.head !== null && this.tail !== null;
	}

	public clear(): void {
		// fixme there might be a memory leak, we need to unlink all nodes
		this.head = null;
		this.tail = null;
	}
}

export { DoublyLinkedList, DoublyLinkedListNode, DoublyLinkedListIterator, NEXT_SYM, PREV_SYM };

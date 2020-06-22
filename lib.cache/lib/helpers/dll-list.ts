// FIXME TEST FOR MEMORY LEAKS
// FIXME UNIT TESTS

// eslint-disable-next-line max-classes-per-file
interface DoublyLinkedListNode<Node> {
	prev: Node | null;
	next: Node | null;
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
		this.node = this.node.next;

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
		node.next = this.head;
		node.prev = null;

		if (this.head !== null) {
			this.head.prev = node;
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

		newNode.next = prevNode.next;
		prevNode.next = newNode;

		newNode.prev = prevNode;
		if (newNode.next !== null) {
			newNode.next.prev = newNode;
		} else {
			this.tail = newNode;
		}
	}

	public removeNode(node: Node): void {
		const prevNode = node.prev;
		const nextNode = node.next;

		if (prevNode !== null) {
			prevNode.next = nextNode;
		} else {
			this.head = nextNode;
		}

		if (nextNode !== null) {
			nextNode.prev = prevNode;
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

export { DoublyLinkedList, DoublyLinkedListNode, DoublyLinkedListIterator };

// FIXME TEST FOR MEMORY LEAKS

interface DoublyLinkedListNode<Node> {
	prev: Node | null;
	next: Node | null;
}

class DoublyLinkedList<Node extends DoublyLinkedListNode<Node>> {
	public head: Node | null = null;

	public tail: Node | null = null;

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

	public clear(): void {
		// fixme there might be a memory leak
		this.head = null;
		this.tail = null;
	}
}

export { DoublyLinkedList, DoublyLinkedListNode };

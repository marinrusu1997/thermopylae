import { Comparator, Undefinable } from '@thermopylae/core.declarations';

/**
 * @private
 */
const HEAP_NODE_IDX_SYM = Symbol('HEAP_NODE_INDEX_SYMBOL');

/**
 * @private
 */
interface HeapNode {
	[HEAP_NODE_IDX_SYM]: number;
}

/**
 * @private
 */
class Heap<T extends HeapNode> {
	private readonly comparator: Comparator<T>;

	private readonly nodes: Array<T>;

	public constructor(comparator: Comparator<T>) {
		this.comparator = comparator;
		this.nodes = [];
	}

	public push(node: T): void {
		this.pushNodeIntoInternalCollection(node); // Insert node in the "fartest left location"
		this.propagateUp(node); // Filter the inserted node up
	}

	public peek(): Undefinable<T> {
		return this.root;
	}

	public pop(): Undefinable<T> {
		const lastChildNode = this.nodes.pop(); // extract last child
		let nodeToBeReturned: Undefinable<T>;

		if (this.nodes.length) {
			nodeToBeReturned = this.root; // save current root
			this.root = lastChildNode!; // move last child node to root
			this.propagateDown(lastChildNode!); // find the "correct" position for the new root
		} else {
			nodeToBeReturned = lastChildNode;
		}

		if (nodeToBeReturned) {
			Heap.detachMetadata(nodeToBeReturned);
		}

		return nodeToBeReturned;
	}

	public delete(node: T): void {
		const { fartestRightNode } = this;

		if (node === fartestRightNode) {
			this.nodes.length -= 1; // just remove it, order and indexes will be preserved
		} else {
			this.swap(node, fartestRightNode); // now `node` became the fartest one...
			this.nodes.length -= 1; // ...and we can simply remove it

			// find the "correct" position of the swapped node
			if (this.propagateDown(fartestRightNode) === fartestRightNode) {
				// it wasn't propagated down, try to propagate up then
				this.propagateUp(fartestRightNode);
			}
		}

		Heap.detachMetadata(node);
	}

	public heapifyUpdatedNode(node: T): void {
		// find the "correct" position of the swapped node
		if (this.propagateDown(node) === node) {
			// it wasn't propagated down, try to propagate up then
			this.propagateUp(node);
		}
	}

	public clear(): void {
		this.nodes.length = 0;
	}

	public get size(): number {
		return this.nodes.length;
	}

	public static isPartOfHeap(node: HeapNode): boolean {
		return node[HEAP_NODE_IDX_SYM] != null;
	}

	private get root(): T {
		return this.nodes[0];
	}

	private set root(node: T) {
		this.nodes[0] = node;
		node[HEAP_NODE_IDX_SYM] = 0; // update index
	}

	private get fartestRightNode(): T {
		return this.nodes[this.nodes.length - 1];
	}

	private propagateUp(node: T): void {
		let parent: T;
		while (Heap.isNotRoot(node)) {
			parent = this.parent(node);
			if (this.comparator(node, parent) < 0) {
				this.swap(node, parent); // move up
			} else {
				return;
			}
		}
	}

	/**
	 * Propagates `node` down the heap to preserve his properties.
	 *
	 * @private
	 *
	 * @param node	Node to propagate down.
	 *
	 * @returns		The node where propagation stopped. <br/>
	 * 				Might return the same `node` from argument if no propagation occurred.
	 */
	private propagateDown(node: T): T {
		let leftChild = this.leftChild(node);
		let rightChild: Undefinable<T>;

		let largest;

		// if doesn't have left child, then it does not have children at all
		while (leftChild) {
			largest = node; // assuming `node` is the largest one

			if (this.comparator(leftChild, largest) < 0) {
				largest = leftChild;
			}

			rightChild = this.rightSibling(leftChild);
			if (rightChild && this.comparator(rightChild, largest) < 0) {
				largest = rightChild;
			}

			if (largest === node) {
				return node;
			}

			this.swap(node, largest); // propagate down the node

			leftChild = this.leftChild(node); // left child of the largest node
		}

		return node;
	}

	private swap(first: T, second: T): void {
		this.nodes[first[HEAP_NODE_IDX_SYM]] = second;
		this.nodes[second[HEAP_NODE_IDX_SYM]] = first;

		const aux = first[HEAP_NODE_IDX_SYM];
		first[HEAP_NODE_IDX_SYM] = second[HEAP_NODE_IDX_SYM];
		second[HEAP_NODE_IDX_SYM] = aux;
	}

	private pushNodeIntoInternalCollection(node: T): void {
		this.nodes.push(node);
		node[HEAP_NODE_IDX_SYM] = this.nodes.length - 1; // right most child node
	}

	private leftChild(parentNode: T): Undefinable<T> {
		return this.nodes[parentNode[HEAP_NODE_IDX_SYM] * 2 + 1];
	}

	private rightSibling(childNode: T): Undefinable<T> {
		return this.nodes[childNode[HEAP_NODE_IDX_SYM] + 1];
	}

	private parent(childNode: T): T {
		// eslint-disable-next-line no-bitwise
		return this.nodes[(childNode[HEAP_NODE_IDX_SYM] - 1) >> 1];
	}

	private static isNotRoot<Node extends HeapNode>(node: Node): boolean {
		return node[HEAP_NODE_IDX_SYM] !== 0;
	}

	private static detachMetadata(node: HeapNode): void {
		node[HEAP_NODE_IDX_SYM] = undefined!; // logical delete
	}
}

export { Heap, HeapNode, HEAP_NODE_IDX_SYM };

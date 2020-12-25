import { Nullable } from '@thermopylae/core.declarations';

/**
 * [Linked List](https://en.wikipedia.org/wiki/Linked_list "Linked list") data structure.
 *
 * @private
 */
interface LinkedList<Node> extends Iterable<Node> {
	head: Nullable<Node>;
	tail: Nullable<Node>;
	size: number;

	/**
	 * Adds `node` to the front of the list.
	 */
	unshift(node: Node): void;

	/**
	 * Adds `node` to the tail of the list.
	 */
	push(node: Node): void;

	/**
	 * Adds `node` after the `position` node.
	 */
	splice(position: Node, node: Node): void;

	/**
	 * Remove `node` from list.
	 */
	remove(node: Node): void;

	/**
	 * Moves `node` to the front of the list.
	 */
	toFront(node: Node): void;

	/**
	 * Remove all elements from the list.
	 */
	clear(): void;

	/**
	 * Verify if list is empty.
	 */
	empty(): boolean;
}

export { LinkedList };

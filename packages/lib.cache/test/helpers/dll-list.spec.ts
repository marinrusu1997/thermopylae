import { describe, it } from 'mocha';
import { assert, expect } from '@thermopylae/lib.unit-test';
import { Nullable } from '@thermopylae/core.declarations';
import { array } from '@thermopylae/lib.utils';
import arrayMove from 'array-move';
import colors from 'colors';
// @ts-ignore
import gc from 'js-gc';
import { DoublyLinkedList, DoublyLinkedListNode, NEXT_SYM, PREV_SYM } from '../../lib/helpers/dll-list';

class Node<T = number> implements DoublyLinkedListNode<Node<T>> {
	public [NEXT_SYM]: Nullable<Node<T>>;

	public [PREV_SYM]: Nullable<Node<T>>;

	public data: T;

	public constructor(data: T) {
		this[NEXT_SYM] = null;
		this[PREV_SYM] = null;
		this.data = data;
	}
}

function assertListContainsAllNodes<T extends DoublyLinkedListNode<T>>(dll: DoublyLinkedList<T>, nodes: Array<T>): void | never {
	let iter = 0;
	for (const listNode of dll) {
		expect(listNode).to.be.eq(nodes[iter++]);
	}
	expect(iter).to.be.eq(nodes.length);
}

describe(`${colors.magenta(DoublyLinkedList.name)} spec`, () => {
	it('should create an empty list and iterate over it', () => {
		const dll = new DoublyLinkedList();
		for (const _ of dll) {
			assert(false, 'List should be empty');
		}
	});

	it('should add nodes to front', () => {
		const dll = new DoublyLinkedList<Node>();
		const nodes = new Array<Node>();

		for (let i = 0; i < 10; i++) {
			const node = new Node(i);

			dll.addToFront(node);
			nodes.unshift(node);

			assertListContainsAllNodes(dll, nodes);
		}
	});

	it('should append after specified node', () => {
		const dll = new DoublyLinkedList<Node>();
		dll.appendAfter(null!, new Node<number>(0)); // will insert at the beginning

		const nodes = new Array<Node>(dll.head!);

		for (let i = 1; i < 20; i++) {
			const appendNode = array.randomElement(nodes);
			const newNode = new Node(i);

			dll.appendAfter(appendNode, newNode);
			// mimic behaviour of append after in the list
			nodes.splice(nodes.indexOf(appendNode) + 1, 0, newNode);

			assertListContainsAllNodes(dll, nodes);
		}
	});

	it('should remove nodes', () => {
		const dll = new DoublyLinkedList<Node>();
		const nodes = new Array<Node>(10);

		for (let i = 0; i < 10; i++) {
			const node = new Node(i);
			dll.addToFront(node);
			nodes[9 - i] = node;
		}

		while (!dll.empty() && nodes.length) {
			const removed = array.randomElement(nodes);
			dll.removeNode(removed);
			array.remove(nodes, (node) => node === removed);

			assertListContainsAllNodes(dll, nodes);
		}
	});

	it('should move nodes to front', () => {
		const dll = new DoublyLinkedList<Node>();
		const nodes = new Array<Node>(10);

		for (let i = 0; i < 10; i++) {
			const node = new Node(i);
			dll.addToFront(node);
			nodes[9 - i] = node;
		}

		for (let i = 0; i < 20; i++) {
			const node = array.randomElement(nodes);
			dll.moveToFront(node);
			arrayMove.mutate(nodes, nodes.indexOf(node), 0);

			assertListContainsAllNodes(dll, nodes);
		}
	});

	it('should clear all nodes from list', () => {
		const dll = new DoublyLinkedList<Node>();

		gc();
		const memUsageBeforeInsert = { ...process.memoryUsage() };

		for (let i = 0; i < 1e5; i++) {
			dll.addToFront(new Node<number>(i));
		}

		dll.clear();
		gc();
		const memUsageAfterClear = { ...process.memoryUsage() };

		expect(memUsageAfterClear.heapTotal).to.be.at.most(memUsageBeforeInsert.heapTotal);
		expect(memUsageAfterClear.heapUsed).to.be.at.most(memUsageBeforeInsert.heapUsed);
		expect(memUsageAfterClear.external).to.be.at.most(memUsageBeforeInsert.external);
		expect(memUsageAfterClear.arrayBuffers).to.be.at.most(memUsageBeforeInsert.arrayBuffers);
	});
});

// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it } from 'mocha';
import { assert, expect } from '@thermopylae/dev.unit-test';
import { Nullable } from '@thermopylae/core.declarations';
import { array } from '@thermopylae/lib.utils';
import arrayMove from 'array-move';
import colors from 'colors';
// @ts-ignore This package has no typings
import gc from 'js-gc';
import { DoublyLinkedList, DoublyLinkedListNode, NEXT_SYM, PREV_SYM } from '../../lib/data-structures/list/doubly-linked';

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

			dll.unshift(node);
			nodes.unshift(node);

			assertListContainsAllNodes(dll, nodes);
		}
	});

	it('should add nodes to back', () => {
		const dll = new DoublyLinkedList<Node>();
		const nodes = new Array<Node>();

		// add to back
		for (let i = 0; i < 10; i++) {
			const node = new Node(i);

			dll.push(node);
			nodes.push(node);

			assertListContainsAllNodes(dll, nodes);
		}

		// remove to ensure it works ok
		while (!dll.empty() && nodes.length) {
			const removed = array.randomElement(nodes);
			dll.remove(removed);
			array.remove(nodes, (node) => node === removed);

			assertListContainsAllNodes(dll, nodes);
		}

		// add to back again
		for (let i = 0; i < 10; i++) {
			const node = new Node(i);

			dll.push(node);
			nodes.push(node);

			assertListContainsAllNodes(dll, nodes);
		}
	});

	it('should append after specified node', () => {
		const dll = new DoublyLinkedList<Node>(new Node(0));

		const nodes = new Array<Node>(dll.head!);

		for (let i = 1; i < 20; i++) {
			const appendNode = array.randomElement(nodes);
			const newNode = new Node(i);

			dll.insertAfter(appendNode, newNode);
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
			dll.unshift(node);
			nodes[9 - i] = node;
		}

		while (!dll.empty() && nodes.length) {
			const removed = array.randomElement(nodes);
			dll.remove(removed);
			array.remove(nodes, (node) => node === removed);

			assertListContainsAllNodes(dll, nodes);
		}
	});

	it('should move nodes to front', () => {
		const dll = new DoublyLinkedList<Node>();
		const nodes = new Array<Node>(10);

		for (let i = 0; i < 10; i++) {
			const node = new Node(i);
			dll.unshift(node);
			nodes[9 - i] = node;
		}

		for (let i = 0; i < 20; i++) {
			const node = array.randomElement(nodes);
			dll.toFront(node);
			arrayMove.mutate(nodes, nodes.indexOf(node), 0);

			assertListContainsAllNodes(dll, nodes);
		}
	});

	// eslint-disable-next-line mocha/no-skipped-tests
	it.skip('should clear all nodes from list', () => {
		const dll = new DoublyLinkedList<Node>();
		const DELTA = 250_000;

		gc();
		const memUsageBeforeInsert = { ...process.memoryUsage() };

		for (let i = 0; i < 1e5; i++) {
			dll.unshift(new Node<number>(i));
		}

		dll.clear();
		gc();
		const memUsageAfterClear = { ...process.memoryUsage() };

		expect(memUsageAfterClear.heapTotal).to.be.at.most(memUsageBeforeInsert.heapTotal);
		expect(memUsageAfterClear.heapUsed).to.be.within(memUsageBeforeInsert.heapUsed - DELTA, memUsageBeforeInsert.heapUsed + DELTA);
		expect(memUsageAfterClear.external).to.be.within(memUsageBeforeInsert.external - DELTA, memUsageBeforeInsert.external + DELTA);
		expect(memUsageAfterClear.arrayBuffers).to.be.at.most(memUsageBeforeInsert.arrayBuffers);
	});

	describe(`${'size'.magenta} spec`, () => {
		it('should be initialized correctly in constructor', () => {
			const emptyDll = new DoublyLinkedList<Node>();
			expect(emptyDll.size).to.be.eq(0);

			const dll = new DoublyLinkedList<Node>(new Node(1));
			expect(dll.size).to.be.eq(1);
		});

		it('should increase when new items are added', () => {
			const dll = new DoublyLinkedList<Node>(new Node(1));

			dll.unshift(new Node(2));
			expect(dll.size).to.be.eq(2);

			dll.push(new Node(3));
			expect(dll.size).to.be.eq(3);

			dll.insertAfter(dll.head!, new Node(4));
			expect(dll.size).to.be.eq(4);
		});

		it('should decrease when item is removed', () => {
			const dll = new DoublyLinkedList<Node>(new Node(1));
			expect(dll.size).to.be.eq(1);

			dll.remove(dll.head!);
			expect(dll.size).to.be.eq(0);
		});

		it('should remain the same when items are moved to front', () => {
			const dll = new DoublyLinkedList<Node>(new Node(1));
			expect(dll.size).to.be.eq(1);

			dll.toFront(dll.head!);
			expect(dll.size).to.be.eq(1);

			dll.unshift(new Node(2));
			expect(dll.size).to.be.eq(2);

			dll.toFront(dll.tail!);
			expect(dll.size).to.be.eq(2);
		});

		it('should be reset on clear', () => {
			const dll = new DoublyLinkedList<Node>(new Node(1));
			expect(dll.size).to.be.eq(1);

			dll.clear();
			expect(dll.size).to.be.eq(0);
		});
	});
});

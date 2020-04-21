import { DLLItem, DLL } from '@akashbabu/node-dll';
import { Threshold } from '@thermopylae/core.declarations';
import { Deleter, EvictionPolicy } from '../contracts/eviction-policy';
import { ExpirableCacheValue } from '../contracts/cache';

interface FreqListItem<Key = string> {
	frequency: number;
	keys: Set<Key>;
}

interface NodeListItem<Key = string> {
	key: Key;
	freqParentItem: DLLItem<FreqListItem<Key>>;
}

interface ExpirableCacheKey<Key = any, Value = any> extends ExpirableCacheValue<Value> {
	nodeListItem: DLLItem<NodeListItem<Key>>;
}

interface LFUEvictionPolicyOptions {
	capacity: Threshold;
	evictCount: number;
}

class LFUEvictionPolicy<Key = string, Value = any> implements EvictionPolicy<Key, Value, ExpirableCacheKey<Key, Value>> {
	private readonly config: LFUEvictionPolicyOptions;

	private delete: Deleter<Key>;

	private readonly freqList: DLL<FreqListItem<Key>>;

	private readonly nodeList: DLL<NodeListItem<Key>>;

	constructor(capacity: number, evictCount?: number, deleter?: Deleter<Key>) {
		this.config = {
			capacity,
			evictCount: evictCount || Math.max(1, capacity * 0.1)
		};
		this.delete = deleter!;
		this.freqList = new DLL<FreqListItem<Key>>();
		this.nodeList = new DLL<NodeListItem<Key>>();
	}

	public onSet(key: Key, entry: ExpirableCacheKey<Key, Value>, size: number): ExpirableCacheKey<Key, Value> {
		// Check for cache overflow
		if (size === this.config.capacity) {
			this.evict(this.config.evictCount);
		}

		// Add key to frequency list
		const freqListItem = this.addToFreqList(key);

		// Add the new node to nodeList
		const nodeItem = this.nodeList.push({
			key,
			freqParentItem: freqListItem
		});

		// Store info in entry
		entry.nodeListItem = nodeItem;

		return entry;
	}

	public onGet(key: Key, entry: ExpirableCacheKey<Key, Value>): void {
		// Get the current parent frequency item
		const freqListItem = entry.nodeListItem.data.freqParentItem;

		// get next freq item
		let nextFreqListItem = freqListItem.next;

		const nextFreqValue = freqListItem.data.frequency + 1;

		// if the next freq item value is not as expected,
		// then create a new one with the expected freq value
		if (!nextFreqListItem || nextFreqListItem.data.frequency !== nextFreqValue) {
			// create a new freq item list and append it
			// after the curr freq item and add the
			// requested key to freq items list
			nextFreqListItem = this.freqList.appendAfter(freqListItem, {
				frequency: freqListItem.data.frequency + 1,
				keys: new Set<Key>([key])
			});
		} else {
			// add requested key to the next freq list item
			nextFreqListItem.data.keys.add(key);
		}

		this.removeKeyFromFreqItem(freqListItem, key);

		// Set the new parent
		entry.nodeListItem.data.freqParentItem = nextFreqListItem;
	}

	public onDelete(key: Key, entry: ExpirableCacheKey<Key, Value>): void {
		// Remove the key from frequency node item list
		this.removeKeyFromFreqItem(entry.nodeListItem.data.freqParentItem, key);

		// remove the corresponding node from node list
		this.nodeList.remove(entry.nodeListItem);
	}

	public onClear(): void {
		this.freqList.clear();
		this.nodeList.clear();
	}

	public requiresEntryForDeletion(): boolean {
		return true;
	}

	public setDeleter(deleter: Deleter<Key>): void {
		this.delete = deleter;
	}

	private evict(count: number): void {
		// eslint-disable-next-line no-plusplus
		while (count--) {
			const freqListHead = this.freqList.head;

			if (freqListHead) {
				// remove the first key from frequency List head item
				const key = freqListHead.data.keys.keys().next().value;
				this.delete(key);
			}
		}
	}

	private addToFreqList(key: Key): DLLItem<FreqListItem<Key>> {
		const freqListHead = this.freqList.head;

		if (!freqListHead || freqListHead.data.frequency !== 1) {
			this.freqList.unshift({
				frequency: 1,
				keys: new Set<Key>([key])
			});
		} else {
			freqListHead.data.keys.add(key);
		}

		return this.freqList.head as DLLItem<FreqListItem<Key>>;
	}

	private removeKeyFromFreqItem(freqListItem: DLLItem<FreqListItem<Key>>, key: Key): void {
		// remove the requested key from the current freqParentItem
		freqListItem.data.keys.delete(key);

		// if the curr freq item does not have any keys
		// after removing the requested key, then
		// remove the item from freqListItem DLL
		if (freqListItem.data.keys.size === 0) {
			this.freqList.remove(freqListItem);
		}
	}
}

export { LFUEvictionPolicy };

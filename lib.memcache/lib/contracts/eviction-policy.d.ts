import { ExpirableCacheValue } from './cache';

declare type Deleter<Key = string> = (key: Key) => void;

declare interface EvictionPolicy<Key = string, Value = any, Entry extends ExpirableCacheValue<Value> = ExpirableCacheValue<Value>> {
	onSet(key: Key, entry: Entry, size: number): Entry;
	onGet(key: Key, entry: Entry): void;
	onDelete(key: Key, entry?: Entry): void;
	onClear(): void;

	setDeleter(deleter: Deleter<Key>): void;

	readonly requiresEntryForDeletion: boolean;
}

export { EvictionPolicy, Deleter };

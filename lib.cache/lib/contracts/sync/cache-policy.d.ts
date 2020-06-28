import { CacheEntry } from './cache-backend';

declare type Deleter<Key = string> = (key: Key) => void;

declare interface CachePolicy<Key, Value> {
	onSet(key: Key, entry: CacheEntry<Value>, ...args: any[]): void;
	onDelete(key: Key, entry?: CacheEntry<Value>): void;
	onClear(): void;

	setDeleter(deleter: Deleter<Key>): void;

	readonly requiresEntryOnDeletion: boolean;
}

export { CachePolicy, Deleter };

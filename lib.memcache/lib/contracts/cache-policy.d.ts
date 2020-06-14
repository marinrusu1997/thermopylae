declare type Deleter<Key = string> = (key: Key) => void;

declare interface CachePolicy<Key, Value, Entry> {
	onSet(key: Key, entry: Entry, ...args: any[]): void;
	onDelete(key: Key, entry?: Entry): void;
	onClear(): void;

	setDeleter(deleter: Deleter<Key>): void;

	readonly requiresEntryOnDeletion: boolean;
}

export { CachePolicy, Deleter };

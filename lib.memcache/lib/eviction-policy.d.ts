declare type Deleter<Key = string> = (key: Key) => void;

declare interface EvictionPolicy<Key = string> {
	access(key: Key): void;
	evict(key: Key): void;
	setDeleter(deleter: Deleter<Key>): void;
}

export { EvictionPolicy, Deleter };

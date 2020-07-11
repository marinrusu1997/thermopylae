import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { CacheEntry } from '../commons';

declare type Deleter<Key = string> = (key: Key) => void;

declare interface SetOperationContext {
	elements: number;
	expiresAfter?: Seconds;
	expiresFrom?: UnixTimestamp;
}

declare const enum EntryValidity {
	NOT_VALID,
	VALID
}

declare interface CachePolicy<Key, Value> {
	onGet(key: Key, entry: CacheEntry<Value>): EntryValidity;
	onSet(key: Key, entry: CacheEntry<Value>, context: SetOperationContext): void;
	onUpdate(key: Key, entry: CacheEntry<Value>, context: SetOperationContext): void;
	onDelete(key: Key, entry?: CacheEntry<Value>): void;
	onClear(): void;

	setDeleter(deleter: Deleter<Key>): void;

	readonly requiresEntryOnDeletion: boolean;
}

export { CachePolicy, Deleter, SetOperationContext, EntryValidity };

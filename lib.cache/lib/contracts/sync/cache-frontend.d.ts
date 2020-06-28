import { Label, Seconds, Undefinable, UnixTimestamp } from '@thermopylae/core.declarations';
import { CacheStats } from './cache-middleend';

declare type EventType = 'set' | 'update' | 'del' | 'flush';

declare type EventListener<Key, Value> = (key?: Key, value?: Value) => void;

declare interface CacheFrontend<Key, Value> {
	readonly name: Label;

	set(key: Key, value: Value, ttl?: Seconds, from?: UnixTimestamp): this;

	upset(key: Key, value: Value, ttl?: Seconds, from?: UnixTimestamp): this;

	get(key: Key): Undefinable<Value>;
	mget(keys: Array<Key>): Map<Key, Value>;

	take(key: Key): Undefinable<Value>;

	del(key: Key): boolean;
	mdel(keys: Array<Key>): void;

	ttl(key: Key, ttl: Seconds, from?: UnixTimestamp): boolean;

	keys(): Array<Key>;

	has(key: Key): boolean;

	clear(): void;

	readonly empty: boolean;

	readonly size: number;

	readonly stats: CacheStats;

	on(event: EventType, listener: EventListener<Key, Value>): this;
}

export { CacheFrontend, EventType, EventListener };

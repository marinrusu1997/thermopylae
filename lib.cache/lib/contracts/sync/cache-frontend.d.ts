import { Label, Seconds, Undefinable, UnixTimestamp } from '@thermopylae/core.declarations';
import { CacheStats, EventType, EventListener } from '../commons.d.ts';

declare interface CacheFrontend<Key, Value> {
	readonly name: Label;

	set(key: Key, value: Value, ttl?: Seconds, from?: UnixTimestamp): this;

	upset(key: Key, value: Value, ttl?: Seconds, from?: UnixTimestamp): this;

	get(key: Key): Undefinable<Value>;
	mget(keys: Array<Key>): Map<Key, Undefinable<Value>>;

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

export { CacheFrontend };

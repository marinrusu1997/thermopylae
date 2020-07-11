import { Undefinable } from '@thermopylae/core.declarations';

declare interface AsyncCacheBackend<Key, Value> {
	get(key: Key): Promise<Undefinable<Value>>;
	set(key: Key, value: Value): Promise<Undefinable<Value>>;
}

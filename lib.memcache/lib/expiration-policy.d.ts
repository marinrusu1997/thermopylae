import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';

declare type Deleter<Key = string> = (key: Key) => void;

declare interface ExpirationPolicy<Key = string> {
	expires(key: Key, after: Seconds, from?: UnixTimestamp): UnixTimestamp | null;

	updateExpires(key: Key, after: Seconds, from?: UnixTimestamp): UnixTimestamp | null;

	expired(key: Key, expires: UnixTimestamp | null): boolean;

	resetExpires(): void;

	setDeleter(deleter: Deleter<Key>): void;
}

export { ExpirationPolicy, Deleter };

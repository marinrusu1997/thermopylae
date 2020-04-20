import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';

declare type Deleter<Key = string> = (key: Key) => void;

declare interface ExpirationPolicy<Key = string> {
	onSet(key: Key, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): UnixTimestamp | null;

	onUpdate(key: Key, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): UnixTimestamp | null;

	isExpired(key: Key, expiresAt: UnixTimestamp | null): boolean;

	onClear(): void;

	setDeleter(deleter: Deleter<Key>): void;
}

export { ExpirationPolicy, Deleter };

import { Node } from 'yallist';
import { AbstractEvictionPolicy } from './abstract-eviction-policy';

class LruEvictionPolicy<Key> extends AbstractEvictionPolicy<Key> {
	accessed(key: Key): void {}

	evict(): boolean {
		return false;
	}
}

export { LruEvictionPolicy };

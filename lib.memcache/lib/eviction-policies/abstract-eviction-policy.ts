import { Deleter, EvictionPolicy } from '../eviction-policy';

abstract class AbstractEvictionPolicy<Key> implements EvictionPolicy<Key> {
	protected delete: Deleter<Key>;

	protected constructor(deleter: Deleter<Key>) {
		this.delete = deleter;
	}

	public setDeleter(deleter: Deleter<Key>): void {
		this.delete = deleter;
	}
}

export { AbstractEvictionPolicy };

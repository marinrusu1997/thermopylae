import { CacheReplacementPolicy, EntryValidity } from '../../contracts/replacement-policy';

class NoExpirationPolicy<Key, Value> implements CacheReplacementPolicy<Key, Value> {
	/**
	 * @inheritDoc
	 */
	public onHit(): EntryValidity {
		return EntryValidity.VALID;
	}

	/**
	 * @inheritDoc
	 */
	public onMiss(_key: Key): void {
		return undefined; // eslint
	}

	/**
	 * @inheritDoc
	 */
	public onSet(): void {
		return undefined;
	}

	/**
	 * @inheritDoc
	 */
	public onUpdate(): void {
		return undefined;
	}

	/**
	 * @inheritDoc
	 */
	public onDelete(): void {
		return undefined;
	}

	/**
	 * @inheritDoc
	 */
	public onClear(): void {
		return undefined;
	}

	/**
	 * @inheritDoc
	 */
	public setDeleter(): void {
		return undefined;
	}

	/**
	 * @inheritDoc
	 */
	get requiresEntryOnDeletion(): boolean {
		return false;
	}
}

export { NoExpirationPolicy };

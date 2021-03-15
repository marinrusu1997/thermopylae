import { CacheReplacementPolicy, EntryValidity } from '../../contracts/replacement-policy';

// @fixme maybe this is not needed, just do not use any policies
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
}

export { NoExpirationPolicy };

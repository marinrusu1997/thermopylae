import { CachePolicy, EntryValidity } from '../../contracts/cache-policy';

class NoExpirationPolicy<Key, Value> implements CachePolicy<Key, Value> {
	public onGet(): EntryValidity {
		return EntryValidity.VALID;
	}

	public onSet(): void {
		return undefined;
	}

	public onUpdate(): void {
		return undefined;
	}

	public onDelete(): void {
		return undefined;
	}

	public onClear(): void {
		return undefined;
	}

	public setDeleter(): void {
		return undefined;
	}

	get requiresEntryOnDeletion(): boolean {
		return false;
	}
}

export { NoExpirationPolicy };

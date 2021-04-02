import { CacheReplacementPolicy, Deleter, EntryValidity } from '../../contracts/replacement-policy';
import { CacheEntry, CacheKey } from '../../contracts/commons';
import { DependencyGraph, GraphEntry } from '../../data-structures/dependency-graph';
import { ReadonlyCacheBackend } from '../../contracts/cache-backend';
import { createException, ErrorCodes } from '../../error';

interface CacheEntryWithDependencies<Key, Value> extends CacheKey<Key>, CacheEntry<Value>, GraphEntry {}

interface EntryDependenciesEvictionPolicyArgumentsBundle<Key> {
	dependencies?: Array<Key>;
	dependents?: Array<Key>;
}

class EntryDependenciesEvictionPolicy<
	Key,
	Value,
	ArgumentsBundle extends EntryDependenciesEvictionPolicyArgumentsBundle<Key> = EntryDependenciesEvictionPolicyArgumentsBundle<Key>
> implements CacheReplacementPolicy<Key, Value, ArgumentsBundle> {
	/**
	 * @private
	 */
	private readonly dependencyGraph: DependencyGraph<CacheEntryWithDependencies<Key, Value>>;

	private readonly readonlyCacheBackend: ReadonlyCacheBackend<Key, Value>;

	private readonly visitedEntriesOnDeletion: Set<CacheEntryWithDependencies<Key, Value>>;

	private deleteFromCache!: Deleter<Key, Value>;

	public constructor(readonlyCacheBackend: ReadonlyCacheBackend<Key, Value>) {
		this.dependencyGraph = new DependencyGraph<CacheEntryWithDependencies<Key, Value>>();
		this.readonlyCacheBackend = readonlyCacheBackend;
		this.visitedEntriesOnDeletion = new Set<CacheEntryWithDependencies<Key, Value>>();
	}

	public onGet(): EntryValidity {
		return EntryValidity.VALID;
	}

	public onSet(key: Key, entry: CacheEntryWithDependencies<Key, Value>, options?: ArgumentsBundle): void {
		entry.key = key; // dependencies might be added later in the form of dependents

		if (options == null) {
			return;
		}

		if (options.dependencies) {
			for (const dependencyKey of options.dependencies) {
				this.dependencyGraph.addDependency(entry, this.getDependencyEntry(dependencyKey));
			}
		}

		if (options.dependents) {
			for (const dependentKey of options.dependents) {
				this.dependencyGraph.addDependency(this.getDependencyEntry(dependentKey), entry);
			}
		}
	}

	/**
	 * This method doesn't manipulate cache dependencies.
	 * @inheritDoc
	 */
	public onUpdate(): void {
		return undefined;
	}

	public onDelete(_key: Key, entry: CacheEntryWithDependencies<Key, Value>): void {
		this.visitedEntriesOnDeletion.add(entry);

		const dependencies = this.dependencyGraph.directDependenciesOf(entry);

		let i = dependencies.length;
		while (i-- && dependencies.length) {
			if (this.visitedEntriesOnDeletion.has(dependencies[i])) {
				continue; // prevent cycles
			}
			this.deleteFromCache(dependencies[i].key, dependencies[i]); // cascade delete
		}

		this.visitedEntriesOnDeletion.delete(entry);
		this.dependencyGraph.removeNode(entry); // remove from graph & detach metadata
	}

	public onClear(): void {
		// do nothing, gc should be able to free entries, even if they have references to each other
		// same happens with linked lists
	}

	public setDeleter(deleter: Deleter<Key, Value>): void {
		this.deleteFromCache = deleter;
	}

	private getDependencyEntry(dependencyKey: Key): CacheEntryWithDependencies<Key, Value> | never {
		const foreignEntry = this.readonlyCacheBackend.get(dependencyKey);
		if (foreignEntry == null) {
			throw createException(ErrorCodes.NOT_FOUND, `Entry associated with key '${dependencyKey}' wasn't found.`);
		}
		return foreignEntry as CacheEntryWithDependencies<Key, Value>;
	}
}

export { EntryDependenciesEvictionPolicy, EntryDependenciesEvictionPolicyArgumentsBundle, CacheEntryWithDependencies };

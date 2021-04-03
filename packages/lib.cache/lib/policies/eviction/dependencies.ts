import { CacheReplacementPolicy, Deleter, EntryValidity } from '../../contracts/cache-replacement-policy';
import { CacheEntry, CacheKey } from '../../contracts/commons';
import { DependencyGraph, GraphEntry } from '../../data-structures/dependency-graph';
import { ReadonlyCacheBackend } from '../../contracts/cache-backend';
import { createException, ErrorCodes } from '../../error';

interface CacheEntryWithDependencies<Key, Value> extends CacheKey<Key>, CacheEntry<Value>, GraphEntry {}

interface EntryDependenciesEvictionPolicyArgumentsBundle<Key> {
	/**
	 * Dependencies of the entry.
	 */
	dependencies?: Array<Key>;
	/**
	 * Dependents of the entry.
	 */
	dependents?: Array<Key>;
	/**
	 * Behaviour to take when dependency not present in the {@link ReadonlyCacheBackend}:
	 * Strict mode  | Behaviour
	 * ------------ | -------------
	 * true  		| An exception will be thrown, and entry insertion will fail. There aren't any exception guarantees, meaning that after exception is thrown, state of the this and other policies might be corrupted. You can use strict mode for debugging or testing, in production is not recommended to use it.
	 * false  		| Dependency will be ignored and relationship with entry won't be established.
	 *
	 * Defaults to **false**.
	 */
	strict?: boolean;
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

		let dependencyEntry;

		if (options.dependencies) {
			for (const dependencyKey of options.dependencies) {
				dependencyEntry = this.readonlyCacheBackend.get(dependencyKey) as CacheEntryWithDependencies<Key, Value>;
				if (dependencyEntry == null) {
					if (options.strict) {
						throw createException(ErrorCodes.NOT_FOUND, `Dependency '${dependencyKey}' of the '${key}' wasn't found.`);
					}
					continue;
				}

				this.dependencyGraph.addDependency(entry, dependencyEntry);
			}
		}

		if (options.dependents) {
			for (const dependentKey of options.dependents) {
				dependencyEntry = this.readonlyCacheBackend.get(dependentKey) as CacheEntryWithDependencies<Key, Value>;
				if (dependencyEntry == null) {
					if (options.strict) {
						throw createException(ErrorCodes.NOT_FOUND, `Dependent '${dependentKey}' of the '${key}' wasn't found.`);
					}
					continue;
				}

				this.dependencyGraph.addDependency(dependencyEntry, entry);
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
}

export { EntryDependenciesEvictionPolicy, EntryDependenciesEvictionPolicyArgumentsBundle, CacheEntryWithDependencies };

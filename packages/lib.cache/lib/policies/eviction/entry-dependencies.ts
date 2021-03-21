import { CacheReplacementPolicy, Deleter, EntryValidity } from '../../contracts/replacement-policy';
import { CacheEntry, CacheEntryGetter, CacheKey } from '../../contracts/commons';
import { Graph } from '../../data-structures/graph/interface';
import { DependencyGraph, GraphEntry } from '../../data-structures/graph/dependency-graph';
import { createException, ErrorCodes } from '../../error';

interface CacheEntryWithDependencies<Key, Value> extends CacheKey<Key>, CacheEntry<Value>, GraphEntry {}

interface EntryDependenciesEvictionPolicyArgumentsBundle<Key> {
	dependencies?: Array<Key>;
	dependents?: Array<Key>;
}

class EntryDependenciesEvictionPolicy<Key, Value, ArgumentsBundle extends EntryDependenciesEvictionPolicyArgumentsBundle<Key>>
	implements CacheReplacementPolicy<Key, Value, ArgumentsBundle> {
	/**
	 * @private
	 */
	private readonly dependencyGraph: Graph<CacheEntryWithDependencies<Key, Value>>;

	private readonly getCacheEntry: CacheEntryGetter<Key, Value>;

	private readonly visitedEntriesOnDeletion: Set<CacheEntryWithDependencies<Key, Value>>;

	private deleteFromCache!: Deleter<Key, Value>;

	public constructor(getCacheEntry: CacheEntryGetter<Key, Value>) {
		this.dependencyGraph = new DependencyGraph<CacheEntryWithDependencies<Key, Value>>();
		this.getCacheEntry = getCacheEntry;
		this.visitedEntriesOnDeletion = new Set<CacheEntryWithDependencies<Key, Value>>();
	}

	public onGet(): EntryValidity {
		return EntryValidity.VALID;
	}

	// @fixme text with various types of graphs
	public onSet(_key: Key, entry: CacheEntryWithDependencies<Key, Value>, options?: ArgumentsBundle): void {
		if (options == null) {
			return;
		}

		// @fixme test with keys that don't exist yet in graph, and also with duplicates, reinserts after exceptions

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

	// @fixme test on complex example from notebook
	// @fixme test with nodes that do not form dependencies with another nodes
	// @fixme test with other policies (lru + sliding for example)
	public onDelete(_key: Key, entry: CacheEntryWithDependencies<Key, Value>): void {
		if (this.visitedEntriesOnDeletion.has(entry)) {
			return; // prevent cycles
		}
		this.visitedEntriesOnDeletion.add(entry);

		const dependencies = this.dependencyGraph.directDependenciesOf(entry);
		for (const dependency of dependencies) {
			this.deleteFromCache(dependency.key, dependency); // cascade delete
			this.dependencyGraph.removeNode(dependency);
		}

		this.visitedEntriesOnDeletion.delete(entry);
	}

	public onClear(): void {
		// do nothing, gc should be able to free entries, even if they have references to each other
		// same happens with linked lists
	}

	public setDeleter(deleter: Deleter<Key, Value>): void {
		this.deleteFromCache = deleter;
	}

	private getDependencyEntry(dependencyKey: Key): CacheEntryWithDependencies<Key, Value> | never {
		const foreignEntry = this.getCacheEntry(dependencyKey);
		if (foreignEntry == null) {
			throw createException(ErrorCodes.NOT_FOUND, `Entry associated with key '${dependencyKey}' wasn't found.`);
		}
		return foreignEntry as CacheEntryWithDependencies<Key, Value>;
	}
}

export { EntryDependenciesEvictionPolicy };

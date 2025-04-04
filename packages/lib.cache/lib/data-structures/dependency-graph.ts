import { array } from '@thermopylae/lib.utils';

/** @private */
const DEPENDENCIES_SYM = Symbol('GRAPH_DEPENDENCIES_SYM');

/** @private */
const DEPENDENTS_SYM = Symbol('GRAPH_DEPENDENTS_SYM');

/** @private */
interface GraphEntry {
	[DEPENDENCIES_SYM]?: Array<GraphEntry>;
	[DEPENDENTS_SYM]?: Array<GraphEntry>;
}

/** @private */
class DependencyGraph<GraphNode extends GraphEntry> {
	private static readonly NO_DEPENDENCIES = [];

	public removeNode(node: GraphNode): void {
		// this might be a leaf
		if (node[DEPENDENCIES_SYM]) {
			for (const dependency of node[DEPENDENCIES_SYM]!) {
				array.removeInPlace(dependency[DEPENDENTS_SYM]!, node);
			}
			node[DEPENDENCIES_SYM] = undefined; // soft delete
		}

		// this might be a solitaire node
		if (node[DEPENDENTS_SYM]) {
			for (const dependent of node[DEPENDENTS_SYM]!) {
				array.removeInPlace(dependent[DEPENDENCIES_SYM]!, node);
			}
			node[DEPENDENTS_SYM] = undefined!; // soft delete
		}
	}

	public addDependency(from: GraphNode, to: GraphNode): void {
		DependencyGraph.dependencies(from).push(to);
		DependencyGraph.dependents(to).push(from);
	}

	public directDependenciesOf(node: GraphNode): ReadonlyArray<GraphNode> {
		return (node[DEPENDENCIES_SYM] || DependencyGraph.NO_DEPENDENCIES) as Array<GraphNode>;
	}

	private static dependencies(node: GraphEntry): Array<GraphEntry> {
		if (node[DEPENDENCIES_SYM] == null) {
			node[DEPENDENCIES_SYM] = [];
		}
		return node[DEPENDENCIES_SYM]!;
	}

	private static dependents(node: GraphEntry): Array<GraphEntry> {
		if (node[DEPENDENTS_SYM] == null) {
			node[DEPENDENTS_SYM] = [];
		}
		return node[DEPENDENTS_SYM]!;
	}
}

export { DependencyGraph, type GraphEntry, DEPENDENCIES_SYM, DEPENDENTS_SYM };

import { array } from '@thermopylae/lib.utils';

const DEPENDENCIES_SYM = Symbol('GRAPH_DEPENDENCIES_SYM');
const DEPENDENTS_SYM = Symbol('GRAPH_DEPENDENTS_SYM');

interface GraphEntry {
	[DEPENDENCIES_SYM]?: Array<GraphEntry>;
	[DEPENDENTS_SYM]?: Array<GraphEntry>;
}

class DependencyGraph<GraphNode extends GraphEntry> {
	private static readonly NO_DEPENDENCIES = [];

	public removeNode(node: GraphNode): void {
		// @fixme optimization, making assumption that this method won't be called on nodes that don't take part from graph
		for (const dependency of node[DEPENDENCIES_SYM]!) {
			array.removeInPlace(dependency[DEPENDENTS_SYM]!, node);
		}
		node[DEPENDENCIES_SYM] = undefined; // soft delete

		for (const dependent of node[DEPENDENTS_SYM]!) {
			array.removeInPlace(dependent[DEPENDENCIES_SYM]!, node);
		}
		node[DEPENDENTS_SYM] = undefined!; // soft delete
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

export { DependencyGraph, GraphEntry, DEPENDENCIES_SYM, DEPENDENTS_SYM };

import { array } from '@thermopylae/lib.utils';
import { Graph } from './interface';

const DEPENDENCIES_SYM = Symbol('GRAPH_DEPENDENCIES_SYM');
const DEPENDENTS_SYM = Symbol('GRAPH_DEPENDENTS_SYM');

interface GraphEntry {
	[DEPENDENCIES_SYM]?: Array<GraphEntry>;
	[DEPENDENTS_SYM]?: Array<GraphEntry>;
}

class DependencyGraph<GraphNode extends GraphEntry> implements Graph<GraphNode> {
	private static readonly NO_DEPENDENCIES = [];

	public addNode(node: GraphNode): void {}

	public hasNode(node: GraphNode): boolean {
		return false;
	}

	public removeNode(node: GraphNode): void {
		// @fixme optimization, making assumption that this method won't be called on nodes that don't take part from graph
		for (const dependency of node[DEPENDENCIES_SYM]!) {
			array.removeInPlace(dependency[DEPENDENTS_SYM]!, node);
		}

		for (const dependent of node[DEPENDENTS_SYM]!) {
			array.removeInPlace(dependent[DEPENDENCIES_SYM]!, node);
		}
	}

	public addDependency(from: GraphNode, to: GraphNode): void {
		DependencyGraph.dependencies(from).push(to);
		DependencyGraph.dependents(to).push(from);
	}

	public removeDependency(from: GraphNode, to: GraphNode): void {
		// @fixme optimization, making assumption that this method won't be called on nodes that don't take part from graph
		array.removeInPlace(from[DEPENDENCIES_SYM]!, to);
		array.removeInPlace(to[DEPENDENTS_SYM]!, from);
	}

	public directDependenciesOf(node: GraphNode): ReadonlyArray<GraphNode> {
		return (node[DEPENDENCIES_SYM] || DependencyGraph.NO_DEPENDENCIES) as Array<GraphNode>;
	}

	public directDependentsOf(node: GraphNode): ReadonlyArray<GraphNode> {
		return (node[DEPENDENTS_SYM] || DependencyGraph.NO_DEPENDENCIES) as Array<GraphNode>;
	}

	public clear(): void {}

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

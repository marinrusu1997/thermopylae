declare interface Graph<GraphNode> {
	/**
	 * Add *node* in the graph. <br/>
	 * If *node* already exists, this method will do nothing.
	 *
	 * @param node Graph node.
	 */
	addNode(node: GraphNode): void;

	/**
	 * Remove *node* from the graph. <br/>
	 * If *node* does not exist, this method will do nothing.
	 *
	 * @param node Graph node.
	 */
	removeNode(node: GraphNode): void;

	/**
	 * Check if *node* exists in the graph.
	 *
	 * @param node Graph node.
	 */
	hasNode(node: GraphNode): boolean;

	/**
	 * Add a dependency between two nodes. <br/>
	 * If *to* node does not exist, it will be added into graph prior to establishing dependency.
	 *
	 * @param from  Graph node.
	 * @param to    Graph node.
	 */
	addDependency(from: GraphNode, to: GraphNode): void;

	/**
	 * Remove a dependency between two nodes. <br/>
	 * Both nodes must take part of the graph.
	 *
	 * @param from  Graph node.
	 * @param to    Graph node.
	 */
	removeDependency(from: GraphNode, to: GraphNode): void;

	/**
	 * Get an array containing the direct dependency nodes of the specified *node*.
	 *
	 * @param node  Graph node.
	 *
	 * @returns     Array of graph nodes.
	 */
	directDependenciesOf(node: GraphNode): ReadonlyArray<GraphNode>;

	/**
	 * Get an array containing the nodes that directly depend on the specified *node*.
	 *
	 * @param node  Graph node.
	 *
	 * @returns     Array of graph nodes.
	 */
	directDependentsOf(node: GraphNode): ReadonlyArray<GraphNode>;

	/**
	 * Clear all of the graph nodes along with their dependencies.
	 */
	clear(): void;
}

export { Graph };

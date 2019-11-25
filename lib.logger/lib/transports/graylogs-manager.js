import WinstonGraylog2 from 'winston-graylog2';

const storage = new WeakMap();
/**
 * Private class data
 *
 * @param {Object} _this This of the class
 * @return {{
 *     inputs: Map,
 *     recipes: Map<string, IRecipe>
 * }}
 */
const internal = _this => {
	let data = storage.get(_this);
	if (!data) {
		data = {};
		storage.set(_this, data);
	}
	return data;
};

class GrayLogsManager {
	register(input, endpoint) {
		const privateThis = internal(this);
		if (!privateThis.inputs) {
			privateThis.inputs = new Map();
		}
		privateThis.inputs.set(input, endpoint);
	}

	recipeFor(system, recipe) {
		const privateThis = internal(this);
		if (!privateThis.recipes) {
			privateThis.recipes = new Map();
		}
		privateThis.recipes.set(system, recipe);
	}

	get(system) {
		const { inputs, recipes } = internal(this);
		if (!inputs) {
			return null;
		}
		if (!recipes) {
			throw new Error('no recipes configured');
		}
		const recipe = recipes.get(system) || recipes.get('@all');
		if (!recipe) {
			throw new Error(`no @all recipe and no ${system} recipe were configured`);
		}
		const endpoint = inputs.get(recipe.input);
		if (!endpoint) {
			throw new Error(`Graylog2 endpoint for input ${recipe.input} not configured`);
		}
		recipes.delete(system);
		return new WinstonGraylog2({
			name: `graylog-${system}`,
			level: recipe.level,
			graylog: {
				servers: [endpoint]
			},
			staticMeta: { system }
		});
	}
}

export default GrayLogsManager;
export { GrayLogsManager };

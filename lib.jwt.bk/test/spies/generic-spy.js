import { chai } from '../chai';

const { expect } = chai;

class GenericSpy {
	constructor() {
		this.spyMethods = new Map();
	}

	/**
	 * Clear all tracked methods with their values.
	 * After invoking this method state of the spy is empty.
	 * You have to register your methods from scratch.
	 */
	hardReset() {
		this.spyMethods.clear();
	}

	/**
	 * Clear counter for all tracked methods.
	 * You don't have to register your methods again after invoking this function.
	 */
	softReset() {
		const methods = this.spyMethods.keys();
		// eslint-disable-next-line no-restricted-syntax
		for (const method of methods) {
			this.spyMethods.set(method, 0);
		}
	}

	/**
	 * Register method for spy tracking.
	 * Counter is set to 0.
	 *
	 * @param {string}  method  Method name
	 */
	register(method) {
		this.spyMethods.set(method, 0);
	}

	/**
	 * Removes method from spy tracked ones.
	 *
	 * @param {string}  method  Method name
	 */
	unregister(method) {
		this.spyMethods.delete(method);
	}

	/**
	 * Increments the invocation counter for tracked method.
	 * If your method is not registered, he will be auto-registered.
	 *
	 * @param {string}  method Method name
	 */
	count(method) {
		const counter = this.spyMethods.get(method);
		this.spyMethods.set(method, counter ? counter + 1 : 1);
	}

	/**
	 * @typedef {Array<{
	 *   method: string,
	 *   count: number
	 * }>} GenericSpyExpectedResults
	 */
	/**
	 * Check for expected number of times specified methods were called.
	 * Notice that specified methods must be present in registered set.
	 * If you specify methods which were not registered before, set `null` for count.
	 *
	 * @param {GenericSpyExpectedResults} results Expected results for each method
	 */
	expect(results) {
		results.forEach(result => {
			expect(result.count).to.be.equal(this.spyMethods.get(result.method));
		});
	}
}

export default GenericSpy;
export { GenericSpy };

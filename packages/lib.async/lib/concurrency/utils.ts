import type { AsyncFunction, PromiseHolder } from '@thermopylae/core.declarations';

/**
 * Like Promise.all() but runs in series instead of parallel. Will pass the value of the prev func
 * as the input to the next one, therefore a pipeline is simulated.
 *
 * @param   tasks        Array with functions that return a promise.
 * @param   initialValue Initial value of the processing chain.
 *
 * @returns              Results of the tasks.
 */
async function runInSeries<I = any, O = any>(tasks: Array<AsyncFunction<I, O>>, initialValue?: any): Promise<any[]> {
	const returnValues = [];

	let currVal = initialValue;
	for (let i = 0; i < tasks.length; i++) {
		currVal = await tasks[i]!(currVal);
		returnValues.push(currVal);
	}

	return returnValues;
}

/**
 * Convert value into promise.
 *
 * @param   maybePromise Value or promise.
 *
 * @returns              Converted promise.
 */
function toPromise<T>(maybePromise: Promise<T> | T): Promise<T> {
	if (maybePromise && maybePromise instanceof Promise) {
		// is promise
		return maybePromise as Promise<T>;
	}
	return Promise.resolve(maybePromise);
}

/**
 * Synchronizes operation and ensures that it won't be executed concurrently. <br/> Example:
 * <br/><pre><code> async function makeApiCall() { // function body }
 *
 * Const nonConcurrentApiCallMaker = synchronize(makeApiCall);
 *
 * // `makeApiCall` will be called only once const results = await Promise.all([
 * nonConcurrentApiCallMaker(), nonConcurrentApiCallMaker() ]);
 *
 * Expect(results[0]).to.be.eq(results[1]);
 *
 * </code></pre>
 *
 * @param operation
 */
function synchronize<T>(operation: AsyncFunction<void, T>): AsyncFunction<void, T> {
	let inFlight: Promise<T> | false = false;

	return function notConcurrent(): Promise<T> {
		if (!inFlight) {
			inFlight = operation().finally(() => {
				inFlight = false;
			});
		}
		return inFlight as Promise<T>;
	};
}

/**
 * Builds **PromiseHolder** instance.
 *
 * @returns Promise holder.
 */
function buildPromiseHolder<T>(): PromiseHolder<T> {
	const promiseHolder: PromiseHolder<T> = {
		// @ts-ignore They will be assigned in the promise executor
		promise: null,
		// @ts-ignore They will be assigned in the promise executor
		reject: null,
		// @ts-ignore They will be assigned in the promise executor
		resolve: null
	};
	promiseHolder.promise = new Promise<T>((resolve, reject) => {
		promiseHolder.resolve = resolve;
		promiseHolder.reject = reject;
	});
	return promiseHolder;
}

export { runInSeries, toPromise, synchronize, buildPromiseHolder };

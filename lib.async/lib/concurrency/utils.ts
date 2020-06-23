import { AsyncFunction, PromiseHolder } from '@thermopylae/core.declarations';

/**
 * like Promise.all() but runs in series instead of parallel
 * will pass the value of the prev func as the input to the next one,
 * therefore a pipeline is simulated
 *
 * @param 	tasks 			array with functions that return a promise
 * @param	initialValue	initial value of the processing chain
 */
async function runInSeries<I = any, O = any>(tasks: Array<AsyncFunction<I, O>>, initialValue?: any): Promise<any[]> {
	const returnValues = [];

	let currVal = initialValue;
	for (let i = 0; i < tasks.length; i++) {
		// eslint-disable-next-line no-await-in-loop
		currVal = await tasks[i](currVal);
		returnValues.push(currVal);
	}

	return returnValues;
}

function toPromise<T>(maybePromise: Promise<T> | T): Promise<T> {
	if (maybePromise && maybePromise instanceof Promise) {
		// is promise
		return maybePromise as Promise<T>;
	}
	return Promise.resolve(maybePromise);
}

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

function buildPromiseHolder<T>(): PromiseHolder<T> {
	const promiseHolder: PromiseHolder<T> = {
		// @ts-ignore
		promise: null,
		// @ts-ignore
		reject: null,
		// @ts-ignore
		resolve: null
	};
	promiseHolder.promise = new Promise<T>((resolve, reject) => {
		promiseHolder.resolve = resolve;
		promiseHolder.reject = reject;
	});
	return promiseHolder;
}

export { runInSeries, toPromise, synchronize, buildPromiseHolder };

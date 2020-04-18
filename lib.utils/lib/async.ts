import { AsyncFunction } from '@thermopylae/core.declarations';

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

export { runInSeries, toPromise };

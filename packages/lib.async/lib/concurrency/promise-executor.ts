import { AsyncFunction } from '@thermopylae/core.declarations';
import asyncPool from 'tiny-async-pool';
import { ErrorCodes, createException } from '../error';

/**
 * Class which executes a task over a data set.
 */
class PromiseExecutor<Input, Output> {
	public static readonly SEQUENTIAL = 0;

	public static readonly PARALLEL = Infinity;

	private readonly processor: AsyncFunction<Input, Output>;

	private readonly data: ReadonlyArray<Input>;

	private readonly concurrency: number;

	private constructor(processor: AsyncFunction<Input, Output>, data: ReadonlyArray<Input>, concurrency: number) {
		this.processor = processor;
		this.data = data;
		this.concurrency = concurrency;
	}

	/**
	 * Execute processor over data set.
	 *
	 * @returns		Processing results.
	 */
	public execute(): Promise<Array<Output>> {
		return PromiseExecutor.run<Input, Output>(this.processor, this.data, this.concurrency);
	}

	/**
	 * Creates a new {@link PromiseExecutor} which encapsulates task that needs to be run over data set. <br/>
	 * Follows Command Design Pattern.
	 *
	 * @param processor     Processing function.
	 * @param data          Data Set.
	 * @param concurrency   Processing concurrency.
	 * 						Can take the following values: <br/>
	 * 							- 0 - data will be processed in sequential order <br/>
	 * 						 	- [1, *Infinity*) - data will be processed in batches of `concurrency` size <br/>
	 * 						 	- *Infinity* - all data will be processed in parallel
	 */
	public static command<I, O>(processor: AsyncFunction<I, O>, data: ReadonlyArray<I>, concurrency: number): PromiseExecutor<I, O> {
		PromiseExecutor.assertConcurrency(concurrency);
		return new PromiseExecutor<I, O>(processor, data, concurrency);
	}

	/**
	 * Runs `processor` over `data` with specified `concurrency`.
	 *
	 * @param processor     Processing function.
	 * @param data          Data Set.
	 * @param concurrency   Processing concurrency.
	 * 						Can take the following values: <br/>
	 * 							- 0 - data will be processed in sequential order <br/>
	 * 						 	- [1, *Infinity*) - data will be processed in batches of `concurrency` size <br/>
	 * 						 	- *Infinity* - all data will be processed in parallel
	 *
	 * @returns				Processing results.
	 */
	public static async run<I, O>(processor: AsyncFunction<I, O>, data: ReadonlyArray<I>, concurrency: number): Promise<Array<O>> {
		let results: Array<O>;
		switch (concurrency) {
			case PromiseExecutor.SEQUENTIAL:
				results = new Array<O>(data.length);
				for (let i = 0; i < data.length; i++) {
					results[i] = await processor(data[i]);
				}
				break;
			case PromiseExecutor.PARALLEL:
				results = await Promise.all(data.map((item) => processor(item)));
				break;
			default:
				PromiseExecutor.assertConcurrency(concurrency);
				results = await asyncPool<I, O>(concurrency, data, processor);
				break;
		}
		return results;
	}

	/**
	 * Formats `concurrency` to human readable format.
	 *
	 * @param concurrency	Processing concurrency.
	 */
	public static formatConcurrency(concurrency: number): string {
		PromiseExecutor.assertConcurrency(concurrency);
		switch (concurrency) {
			case PromiseExecutor.SEQUENTIAL:
				return 'SEQUENTIAL';
			case PromiseExecutor.PARALLEL:
				return 'PARALLEL';
			default:
				return `BATCHES OF ${concurrency} TASKS`;
		}
	}

	/**
	 * Checks whether `concurrency` has an accepted value.
	 *
	 * @param concurrency   Processing concurrency.
	 */
	private static assertConcurrency(concurrency: number): void {
		const minLimit = 1;
		if (concurrency !== PromiseExecutor.SEQUENTIAL && concurrency <= minLimit) {
			throw createException(
				ErrorCodes.INVALID_ARGUMENT,
				`Concurrency needs to have a min value of ${minLimit + 1}. Provided concurrency: ${concurrency}. ` +
					`${concurrency === minLimit ? `For sequential concurrency please provide ${PromiseExecutor.SEQUENTIAL} value.` : ''}`
			);
		}
	}
}

export { PromiseExecutor };

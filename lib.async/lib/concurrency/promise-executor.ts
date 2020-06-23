import { AsyncFunction } from '@thermopylae/core.declarations';
import asyncPool from 'tiny-async-pool';
import { ErrorCodes, createException } from '../exception';

interface PromiseExecutorTask<Input, Output> {
	readonly processor: AsyncFunction<Input, Output>;
	readonly data: ReadonlyArray<Input>;
	readonly concurrency: number;
}

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
	 * Execute command with encapsulated promises.
	 */
	public execute(): Promise<Array<Output>> {
		return PromiseExecutor.run<Input, Output>({
			processor: this.processor,
			data: this.data,
			concurrency: this.concurrency
		});
	}

	/**
	 * Creates a new Promise executor which encapsulates promises that needs to be run.
	 * Follows Command Design Pattern.
	 *
	 * @param processor     Processing function
	 * @param data          Data Set
	 * @param concurrency   Processing concurrency
	 */
	public static command<I, O>(processor: AsyncFunction<I, O>, data: ReadonlyArray<I>, concurrency: number): PromiseExecutor<I, O> {
		PromiseExecutor.assertConcurrency(concurrency);
		return new PromiseExecutor<I, O>(processor, data, concurrency);
	}

	/**
	 * Runs {@link processor} over {@link data} with specified {@link concurrency}.
	 *
	 * @param processor     Processing function
	 * @param data          Data Set
	 * @param concurrency   Processing concurrency
	 */
	public static async run<I, O>({ processor, data, concurrency }: PromiseExecutorTask<I, O>): Promise<Array<O>> {
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
	 * Formats {@link concurrency} to human readable format.
	 *
	 * @param concurrency	Processing concurrency
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
	 * Checks whether {@link concurrency} has an accepted value.
	 *
	 * @param concurrency   Processing concurrency
	 */
	private static assertConcurrency(concurrency: number): void {
		const minLimit = 1;
		if (concurrency !== PromiseExecutor.SEQUENTIAL && concurrency <= minLimit) {
			throw createException(
				ErrorCodes.INVALID_PARAM,
				`Concurrency needs to have a min value of ${minLimit + 1}. Provided concurrency: ${concurrency}. ` +
					`${concurrency === minLimit ? `For sequential concurrency please provide ${PromiseExecutor.SEQUENTIAL} value.` : ''}`
			);
		}
	}
}

export { PromiseExecutor, PromiseExecutorTask };

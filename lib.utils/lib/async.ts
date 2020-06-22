/* eslint max-classes-per-file: 0 */ // --> OFF

import { AsyncFunction, Milliseconds, PromiseHolder, UnaryPredicate } from '@thermopylae/core.declarations';
import asyncPool from 'tiny-async-pool';
import { createException } from './exception';

const enum ErrorCodes {
	LOCK_NOT_FOUND = 'LOCK_NOT_FOUND',
	TIMEOUT_EXCEEDED = 'TIMEOUT_EXCEEDED',
	INVALID_PARAM = 'INVALID_PARAM',
	INCONSISTENCY = 'INCONSISTENCY',
	FORCED_RELEASE = 'FORCED_RELEASE'
}

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
		return inFlight;
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

interface LabeledMutexEntry<T> extends PromiseHolder<T> {
	timeout?: NodeJS.Timeout;
}

class LabeledConditionalVariable<Label = string, Result = any> {
	public static MAX_TIMEOUT: Milliseconds = 500;

	private readonly locks: Map<Label, LabeledMutexEntry<Result>>;

	constructor() {
		this.locks = new Map<Label, LabeledMutexEntry<Result>>();
	}

	/**
	 * Waits on {@link label}.
	 * When lock can't be acquired, Promise of the locked mutex is returned.
	 * This allows consumers to wait on provided promise, until
	 * producer who acquired lock, finishes computation.
	 * If {@link timeout} is provided, and consumers are not notified
	 * in the given interval, promise will be forcibly resolved.
	 *
	 * @param label		Label to wait on.
	 * @param timeout	If returned promise is not resolved within this interval,
	 * 					it will be rejected with related error.
	 */
	public wait(label: Label, timeout?: Milliseconds): [boolean, Promise<Result>] {
		let lock: LabeledMutexEntry<Result> | undefined;
		if ((lock = this.locks.get(label))) {
			return [false, lock.promise];
		}

		lock = buildPromiseHolder<Result>();

		if (timeout && LabeledConditionalVariable.assertTimeout(timeout)) {
			const releaseWithRejection = (): void => {
				const timeoutMessage = `Timeout of ${timeout} ms for label ${label} has been exceeded.`;

				let expiredLock: LabeledMutexEntry<Result> | undefined;
				if ((expiredLock = this.locks.get(label))) {
					this.locks.delete(label);
					return expiredLock.reject(createException(ErrorCodes.TIMEOUT_EXCEEDED, timeoutMessage));
				}

				throw createException(ErrorCodes.INCONSISTENCY, `${timeoutMessage} Attempting to release lock, but it has been released already.`);
			};
			lock.timeout = setTimeout(releaseWithRejection, timeout);
		}

		this.locks.set(label, lock);

		return [true, lock.promise];
	}

	/**
	 * Notify consumers about computation completion.
	 * Although either producer or consumers can call this function,
	 * it is recommended that producer who successfully acquired lock
	 * to notify consumers.
	 *
	 * @param label		Label to notify on.
	 * @param result	Result of the computation or it's error.
	 */
	public notifyAll(label: Label, result?: Result | Error): void {
		let lock: LabeledMutexEntry<Result> | undefined;
		if ((lock = this.locks.get(label))) {
			try {
				if (result && result instanceof Error) {
					lock.reject(result);
				} else {
					lock.resolve(result);
				}
			} finally {
				this.locks.delete(label);
				if (lock.timeout) {
					clearTimeout(lock.timeout);
				}
			}
			return;
		}
		throw createException(ErrorCodes.LOCK_NOT_FOUND, `No lock found for label ${label}.`);
	}

	/**
	 * Notify all consumers on filtered labels by forcibly
	 * resolve promise consumers are waiting on, this will
	 * basically flush locks from all filtered labels.
	 *
	 * @param filter	Filter labels on which forced notify needs to be applied.
	 */
	public forcedNotifyAll(filter: '@all' | UnaryPredicate<Label> = '@all'): void {
		const needsRelease = filter === '@all' ? () => true : filter;

		for (const label of this.locks.keys()) {
			if (needsRelease(label)) {
				this.notifyAll(label, createException(ErrorCodes.FORCED_RELEASE, `Label ${label} has been released forcibly.`));
			}
		}
	}

	/**
	 * Get number of the labels locks has been acquired on.
	 */
	public get size(): number {
		return this.locks.size;
	}

	private static assertTimeout(timeout: Milliseconds): true {
		const minTimeout = 0;
		if (timeout < minTimeout || timeout > LabeledConditionalVariable.MAX_TIMEOUT) {
			throw createException(ErrorCodes.INVALID_PARAM, `Timeout ranges between ${minTimeout} and ${LabeledConditionalVariable.MAX_TIMEOUT}.`);
		}
		return true;
	}
}

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

export { LabeledConditionalVariable, PromiseExecutor, PromiseExecutorTask, ErrorCodes, runInSeries, toPromise, synchronize, buildPromiseHolder };

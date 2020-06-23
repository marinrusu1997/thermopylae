import { Milliseconds, PromiseHolder, UnaryPredicate } from '@thermopylae/core.declarations';
import { ErrorCodes, createException } from '../exception';
import { buildPromiseHolder } from './utils';

interface LabeledMutexEntry<T> extends PromiseHolder<T> {
	timeout?: NodeJS.Timeout;
}

// FIXME this shall be RW Mutex
// FIXME split async into folder with consolidating index.ts
// FIXME check this out https://www.npmjs.com/package/mutex

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

export { LabeledConditionalVariable };

/* eslint no-bitwise: 0 */ // --> OFF

import { AsyncFunction, Milliseconds, PromiseHolder, UnaryPredicate } from '@thermopylae/core.declarations';
import { ErrorCodes, createException } from '../exception';
import { buildPromiseHolder } from './utils';

const enum LockedOperation {
	NOOP = 0,
	READ = 1 << 0,
	WRITE = 1 << 1
}

const enum AwaiterRole {
	PRODUCER,
	CONSUMER
}

interface WaitStatus<T> {
	role: AwaiterRole;
	promise: Promise<T>;
}

interface LabeledMutexEntry<T> extends PromiseHolder<T> {
	operation: LockedOperation;
	timeout?: NodeJS.Timeout;
}

class LabeledConditionalVariable<Label = string, Result = any> {
	public static readonly MAX_TIMEOUT: Milliseconds = 500;

	private readonly locks: Map<Label, LabeledMutexEntry<Result>>;

	constructor() {
		this.locks = new Map<Label, LabeledMutexEntry<Result>>();
	}

	/**
	 * Waits on {@link label}.
	 *
	 * When lock is acquired already, Promise of the locked mutex is returned.
	 * This allows consumers to wait on provided promise, until
	 * producer who firstly acquired lock, finishes computation.
	 *
	 * If {@link timeout} is provided, and consumers are not notified
	 * in the given interval, promise will be forcibly resolved.
	 *
	 * @param label			Label to wait on.
	 * @param [operation]	Operation for which lock needs to be acquired. Defaults to {@link LockedOperation~NOOP}.
	 * @param [timeout]		If returned promise is not resolved within this interval,
	 * 						it will be rejected with related error.
	 */
	public wait(label: Label, operation = LockedOperation.NOOP, timeout?: Milliseconds | null): WaitStatus<Result> {
		LabeledConditionalVariable.assertLockedOperation(operation);

		let lock: LabeledMutexEntry<Result> | undefined;
		if ((lock = this.locks.get(label))) {
			LabeledConditionalVariable.assertLockedOperationsOverlap(label, lock.operation, operation);
			return { role: AwaiterRole.CONSUMER, promise: lock.promise };
		}

		lock = buildPromiseHolder<Result>() as LabeledMutexEntry<Result>;
		lock.operation = operation;

		if (timeout && LabeledConditionalVariable.assertTimeout(label, timeout)) {
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

		return { role: AwaiterRole.PRODUCER, promise: lock.promise };
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
		throw createException(ErrorCodes.LOCK_NOT_FOUND, `Can't unlock. No lock found for label ${label}.`);
	}

	/**
	 * Notify all consumers on filtered labels by forcibly
	 * resolve promise consumers are waiting on, this will
	 * basically flush locks from all filtered labels.
	 *
	 * @param filter	Filter labels on which forced notify needs to be applied.
	 */
	public forcedNotify(filter: '@all' | UnaryPredicate<Label> = '@all'): void {
		const needsRelease = filter === '@all' ? () => true : filter;

		for (const label of this.locks.keys()) {
			if (needsRelease(label)) {
				this.notifyAll(label, createException(ErrorCodes.FORCED_RELEASE, `Label ${label} has been released forcibly.`));
			}
		}
	}

	/**
	 * Runs the `Result` {@link provider} with a {@link label} lock.
	 * Follows the same semantics of {@link LabeledConditionalVariable~wait}
	 * and {@link LabeledConditionalVariable~notifyAll}, by wrapping the call
	 * of {@link provider} inside these functions.
	 *
	 * @param label			Label to use lock on.
	 * @param operation		Operation lock is defending.
	 * @param timeout		Timeout to provide the value.
	 * @param provider		Async function which provides the result to resolve lock promise.
	 * @param args			Arguments of the {@link provider}.
	 */
	public lockedRun(
		label: Label,
		operation: LockedOperation,
		timeout: Milliseconds | null,
		provider: AsyncFunction<any, Result>,
		...args: Array<any>
	): Promise<Result> {
		let waitStatus: WaitStatus<Result>;
		try {
			waitStatus = this.wait(label, operation, timeout);
		} catch (e) {
			return Promise.reject(e);
		}

		if (waitStatus.role !== AwaiterRole.PRODUCER) {
			return waitStatus.promise;
		}

		const doNotify = (res?: Result | Error): Promise<Result> => {
			try {
				this.notifyAll(label, res);
			} catch (notifyErr) {
				if (notifyErr.code !== ErrorCodes.LOCK_NOT_FOUND) {
					throw notifyErr; // process will mostly die here
				}
			}
			return waitStatus.promise;
		};

		return provider(...args)
			.then(doNotify)
			.catch(doNotify);
	}

	/**
	 * Get number of the labels locks has been acquired on.
	 */
	public get size(): number {
		return this.locks.size;
	}

	/**
	 * Ensure {@link timeout} is in the accepted range.
	 *
	 * @param label		Label
	 * @param timeout	Number of ms to wait until forcibly reject mutex's promise.
	 */
	private static assertTimeout<Label>(label: Label, timeout: Milliseconds): never | true {
		const minTimeout = 0;
		if (timeout < minTimeout || timeout > LabeledConditionalVariable.MAX_TIMEOUT) {
			LabeledConditionalVariable.throwInvalidTimeout(label, minTimeout, timeout);
		}
		return true;
	}

	private static assertLockedOperation(operation: LockedOperation): void | never {
		switch (operation) {
			case LockedOperation.NOOP:
			case LockedOperation.READ:
			case LockedOperation.WRITE:
			case LockedOperation.READ | LockedOperation.WRITE:
				return;
			default:
				throw createException(ErrorCodes.INVALID_ARGUMENT, `Requested an unknown operation ${operation}.`);
		}
	}

	/**
	 * The goal of this method is to ensure that a given client
	 * can wait on shared promise, used as a `synchronization primitive`.
	 *
	 * @param acquired		Operation used when promise was locked.
	 * @param requested		Operation used for acquiring the promise again.
	 */
	private static assertLockedOperationsOverlap<Label>(label: Label, acquired: LockedOperation, requested: LockedOperation): never | void {
		if (acquired === LockedOperation.NOOP && requested !== LockedOperation.NOOP) {
			throw createException(
				ErrorCodes.UNABLE_TO_LOCK,
				`Lock acquired for label ${label} on ${LabeledConditionalVariable.formatLockedOperation(acquired)} operation, ` +
					`but requested operation is ${LabeledConditionalVariable.formatLockedOperation(requested)}.`
			);
		}

		if (acquired & LockedOperation.WRITE) {
			throw createException(
				ErrorCodes.UNABLE_TO_LOCK,
				`Lock acquired for label ${label} on ${LabeledConditionalVariable.formatLockedOperation(acquired)} operation, which is an exclusive one. ` +
					`Given: ${LabeledConditionalVariable.formatLockedOperation(requested)}.`
			);
		}

		if (acquired & LockedOperation.READ && requested !== LockedOperation.READ) {
			throw createException(
				ErrorCodes.UNABLE_TO_LOCK,
				`Lock acquired for label ${label} on ${LabeledConditionalVariable.formatLockedOperation(acquired)} operation. ` +
					`Only ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.READ)} operation can be requested. ` +
					`Given: ${LabeledConditionalVariable.formatLockedOperation(requested)}.`
			);
		}
	}

	public static formatLockedOperation(operation: LockedOperation): string {
		LabeledConditionalVariable.assertLockedOperation(operation);

		const representation = [];
		if (operation === LockedOperation.NOOP) {
			return 'Noop';
		}
		if (operation & LockedOperation.READ) {
			representation.push('Read');
		}
		if (operation & LockedOperation.WRITE) {
			representation.push('Write');
		}
		return representation.join('');
	}

	public static formatAwaiterRole(role: AwaiterRole): string {
		switch (role) {
			case AwaiterRole.CONSUMER:
				return 'CONSUMER';
			case AwaiterRole.PRODUCER:
				return 'PRODUCER';
			default:
				LabeledConditionalVariable.throwInvalidAwaiterRole(role);
		}
		return ''; // actually never gets executed, just to calm down eslint
	}

	private static throwInvalidAwaiterRole(role: AwaiterRole): never {
		throw createException(ErrorCodes.INVALID_ARGUMENT, `Awaiter role is not valid. Given ${role}.`);
	}

	private static throwInvalidTimeout<Label>(label: Label, minTimeout: Milliseconds, givenTimeout: Milliseconds): never {
		throw createException(
			ErrorCodes.INVALID_ARGUMENT,
			`Timeout ranges between ${minTimeout} and ${LabeledConditionalVariable.MAX_TIMEOUT} ms. Given: ${givenTimeout}. Label: ${label}.`
		);
	}
}

export { LabeledConditionalVariable, LockedOperation, WaitStatus, AwaiterRole };

/* eslint no-bitwise: 0 */ // --> OFF

import { Milliseconds, PromiseHolder, UnaryPredicate } from '@thermopylae/core.declarations';
import { ErrorCodes, createException } from '../exception';
import { buildPromiseHolder } from './utils';

const enum LockedOperation {
	READ = 1 << 0,
	WRITE = 1 << 1
}

const enum LockPriorityPolicy {
	UNSPECIFIED,
	READ_PREFERRING,
	WRITE_PREFERRING
}

interface WaitStatus<T> {
	acquiredAlready: boolean;
	promise: Promise<T>;
}

interface LabeledMutexEntry<T> extends PromiseHolder<T> {
	operation: LockedOperation;
	timeout?: NodeJS.Timeout;
}

class LabeledConditionalVariable<Label = string, Result = any> {
	public static readonly MAX_TIMEOUT: Milliseconds = 500;

	private readonly lockPriorityPolicy: LockPriorityPolicy;

	private readonly locks: Map<Label, LabeledMutexEntry<Result>>;

	constructor(lockPriorityPolicy = LockPriorityPolicy.UNSPECIFIED) {
		this.lockPriorityPolicy = lockPriorityPolicy;
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
	 * @param label		Label to wait on.
	 * @param operation	Operation for which lock needs to be acquired.
	 * @param timeout	If returned promise is not resolved within this interval,
	 * 					it will be rejected with related error.
	 */
	public wait(label: Label, operation: LockedOperation, timeout?: Milliseconds): WaitStatus<Result> {
		let lock: LabeledMutexEntry<Result> | undefined;
		if ((lock = this.locks.get(label))) {
			LabeledConditionalVariable.assertLockedOperationsOverlap(this.lockPriorityPolicy, lock.operation, operation);
			return LabeledConditionalVariable.buildWaitStatus(lock.promise, true);
		}

		lock = buildPromiseHolder<Result>() as LabeledMutexEntry<Result>;
		lock.operation = operation;

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

		return LabeledConditionalVariable.buildWaitStatus(lock.promise);
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
		throw createException(ErrorCodes.UNABLE_TO_LOCK, `Can't unlock. No lock found for label ${label}.`);
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
	 * Get number of the labels locks has been acquired on.
	 */
	public get size(): number {
		return this.locks.size;
	}

	public static formatLockPriorityPolicy(policy: LockPriorityPolicy): string {
		switch (policy) {
			case LockPriorityPolicy.UNSPECIFIED:
				return 'UNSPECIFIED';
			case LockPriorityPolicy.WRITE_PREFERRING:
				return 'WRITE_PREFERRING';
			case LockPriorityPolicy.READ_PREFERRING:
				return 'READ_PREFERRING';
			default:
				LabeledConditionalVariable.throwInvalidLockPriorityPolicy(policy);
		}
		return ''; // actually never gets executed, just to calm down eslint
	}

	public static formatLockedOperation(operation: LockedOperation): string {
		const representation = [];
		if (operation & LockedOperation.READ) {
			representation.push('R');
		}
		if (operation & LockedOperation.WRITE) {
			representation.push('W');
		}
		if (!representation.length) {
			LabeledConditionalVariable.throwInvalidLockedOperation(operation);
		}
		return representation.join();
	}

	private static buildWaitStatus<V>(promise: Promise<V>, acquiredAlready = false): WaitStatus<V> {
		return { acquiredAlready, promise };
	}

	private static throwInvalidLockPriorityPolicy(policy: LockPriorityPolicy): never {
		throw createException(ErrorCodes.INVALID_ARGUMENT, `Lock priority policy is not valid. Given ${policy}.`);
	}

	private static throwInvalidLockedOperation(operation: LockedOperation): never {
		throw createException(ErrorCodes.INVALID_ARGUMENT, `Locked operation is not valid. Given ${operation}`);
	}

	private static throwLockedOperationMutualExclusion(lockPriorityPolicy: LockPriorityPolicy, acquired: LockedOperation, requested: LockedOperation): never {
		throw createException(
			ErrorCodes.UNABLE_TO_LOCK,
			`Can't request ${LabeledConditionalVariable.formatLockedOperation(requested)} ` +
				`when lock was acquired for ${LabeledConditionalVariable.formatLockedOperation(acquired)} ` +
				`while ${LabeledConditionalVariable.formatLockPriorityPolicy(lockPriorityPolicy)} priority policy is active.`
		);
	}

	/**
	 * Ensure {@link timeout} is in the accepted range.
	 *
	 * @param timeout	Number of ms to wait until forcibly reject mutex's promise.
	 */
	private static assertTimeout(timeout: Milliseconds): never | true {
		const minTimeout = 0;
		if (timeout < minTimeout || timeout > LabeledConditionalVariable.MAX_TIMEOUT) {
			throw createException(ErrorCodes.INVALID_ARGUMENT, `Timeout ranges between ${minTimeout} and ${LabeledConditionalVariable.MAX_TIMEOUT}.`);
		}
		return true;
	}

	/**
	 * The goal of this method is to ensure that a given client
	 * can wait on shared promise, used as a `synchronization primitive`.
	 *
	 * When {@link lockPriorityPolicy} is {@link LockPriorityPolicy~UNSPECIFIED}, everyone
	 * can acquire promise to wait on, no matter what's the {@link requested} operation.
	 *
	 * When {@link lockPriorityPolicy} is {@link LockPriorityPolicy~READ_PREFERRING},
	 * {@link requested} read operation has priority over {@link acquired} write operation.
	 * Mutual exclusion is empowered, meaning that if priority is not satisfied, an error will be thrown.
	 *
	 * When {@link lockPriorityPolicy} is {@link LockPriorityPolicy~WRITE_PREFERRING},
	 * {@link requested} write operation has priority over {@link acquired} read operation.
	 * Mutual exclusion is empowered, meaning that if priority is not satisfied, an error will be thrown.
	 *
	 * @param lockPriorityPolicy	Priority policy for reader vs. writer access.
	 * @param acquired				Operation used when promise was locked.
	 * @param requested				Operation used for acquiring the promise again.
	 */
	private static assertLockedOperationsOverlap(lockPriorityPolicy: LockPriorityPolicy, acquired: LockedOperation, requested: LockedOperation): never | void {
		switch (lockPriorityPolicy) {
			case LockPriorityPolicy.UNSPECIFIED:
				return; // does not matter
			case LockPriorityPolicy.READ_PREFERRING:
				if (acquired & LockedOperation.WRITE && requested & LockedOperation.READ) {
					LabeledConditionalVariable.throwLockedOperationMutualExclusion(lockPriorityPolicy, acquired, requested);
				}
				break;
			case LockPriorityPolicy.WRITE_PREFERRING:
				if (acquired & LockedOperation.READ && requested & LockedOperation.WRITE) {
					LabeledConditionalVariable.throwLockedOperationMutualExclusion(lockPriorityPolicy, acquired, requested);
				}
				break;
			default:
				LabeledConditionalVariable.throwInvalidLockPriorityPolicy(lockPriorityPolicy);
		}
	}
}

export { LabeledConditionalVariable, LockPriorityPolicy, LockedOperation, WaitStatus };

import type { Milliseconds, Optional, PromiseHolder, UnaryPredicate } from '@thermopylae/core.declarations';
import { ErrorCodes, createException } from '../error.js';
import { buildPromiseHolder } from './utils.js';

/** Type of the operation that needs to be performed with lock. */
const enum LockedOperationType {
	/** Read-only operation. */
	READ,
	/** Write-only operation. */
	WRITE
}

/** Role of the client which awaits for lock availability. */
const enum AwaiterRole {
	/**
	 * Producer which obtained lock and started operation. <br/> He is responsible for fulfilling
	 * operation promise.
	 */
	PRODUCER,
	/**
	 * Consumer which obtained lock, but operation has been started already by producer. <br/> He
	 * needs to await on promise for it's fulfilling.
	 */
	CONSUMER
}

/** Operation awaiting status. */
interface WaitStatus<T> {
	/** Role of the awaiter. */
	role: AwaiterRole;
	/** Promise associated with the operation. */
	promise: Promise<T>;
}

/**
 * Mutex entry which has a label (aka identifier).
 *
 * @private
 */
interface LabeledMutexEntry<T> extends PromiseHolder<T> {
	/** Type of the operation that was locked. */
	operation: LockedOperationType;
	/** Operation timeout. */
	timeout?: NodeJS.Timeout;
}

/**
 * Class which manages a set of conditional variables. Each conditional variable has an associated
 * label, aka identifier. <br/> These conditional variables are used to synchronize access to
 * operation. Namely to ensure that operation will be performed only once by the
 * {@link AwaiterRole.PRODUCER}, and then, in case operation is still performing, other
 * {@link AwaiterRole.CONSUMER} can await operation promise, until {@link AwaiterRole.PRODUCER}
 * fulfills it.
 */
class LabeledConditionalVariableManager<Label = string, Result = any> {
	private readonly locks: Map<Label, LabeledMutexEntry<Optional<Result>>>;

	public constructor() {
		this.locks = new Map<Label, LabeledMutexEntry<Optional<Result>>>();
	}

	/**
	 * Waits on `label`. <br/>
	 *
	 * When lock is acquired already, Promise of the locked mutex is returned. This allows consumers
	 * to wait on provided promise, until producer who firstly acquired lock, finishes computation.
	 * <br/>
	 *
	 * Depending on the locked operation type, the following combinations are allowed: <br/>
	 *
	 * | Acquired                          | Requested                        | Explanation                                                                                                                                        |
	 * | --------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
	 * | {@link LockedOperationType.WRITE} | **NONE**                         | When operation was locked for write, i.e. some resource is modified, you can't overwrite it or read intermediary results until operation finishes. |
	 * | {@link LockedOperationType.READ}  | {@link LockedOperationType.READ} | When operation was locked for read, you can only perform another reads and not allowed to write until all reads have been completed.               | <br/> |
	 *
	 * If `timeout` is provided, and consumers are not notified in the given interval, promise will
	 * be forcibly rejected. <br/>
	 *
	 * After operation has been completed, {@link AwaiterRole.PRODUCER} should call
	 * {@link LabeledConditionalVariableManager.notifyAll} to notify consumers about operation
	 * completion.
	 *
	 * @param   label       Label to wait on.
	 * @param   [operation] Operation for which lock needs to be acquired.
	 * @param   [timeout]   If returned promise is not resolved within this interval, it will be
	 *   rejected with related error.
	 *
	 * @returns             Waiting status.
	 */
	public wait(label: Label, operation: LockedOperationType, timeout?: Milliseconds | null): WaitStatus<Optional<Result>> {
		LabeledConditionalVariableManager.assertLockedOperation(operation);

		let lock: LabeledMutexEntry<Optional<Result>> | undefined;
		if ((lock = this.locks.get(label))) {
			LabeledConditionalVariableManager.assertLockedOperationsOverlap(label, lock.operation, operation);
			return { role: AwaiterRole.CONSUMER, promise: lock.promise };
		}

		lock = buildPromiseHolder<Optional<Result>>() as LabeledMutexEntry<Optional<Result>>;
		lock.operation = operation;

		if (timeout && LabeledConditionalVariableManager.assertTimeout(label, timeout)) {
			const releaseWithRejection = (): void => {
				const timeoutMessage = `Timeout of ${timeout} ms for label '${label}' has been exceeded.`;

				let expiredLock: LabeledMutexEntry<Optional<Result>> | undefined;
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
	 * Notify consumers about computation completion. <br/> Although either producer or consumers
	 * can call this function, it is recommended that producer who successfully acquired lock to
	 * notify consumers.
	 *
	 * @param label  Label to notify on.
	 * @param result Result of the computation or it's error.
	 */
	public notifyAll(label: Label, result?: Optional<Result> | Error): void {
		let lock: LabeledMutexEntry<Optional<Result>> | undefined;
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
		throw createException(ErrorCodes.LOCK_NOT_FOUND, `Can't unlock. No lock found for label '${label}'.`);
	}

	/**
	 * Notify all consumers on filtered labels by forcibly rejecting promises consumers are waiting
	 * on. This will basically flush locks from all filtered labels.
	 *
	 * @param filter Filter labels on which forced notify needs to be applied.
	 */
	public forcedNotify(filter: '@all' | UnaryPredicate<Label>): void {
		const needsRelease = filter === '@all' ? () => true : filter;

		for (const label of this.locks.keys()) {
			if (needsRelease(label)) {
				this.notifyAll(label, createException(ErrorCodes.FORCED_RELEASE, `Label '${label}' has been released forcibly.`));
			}
		}
	}

	/** Get number of the labels locks has been acquired on. */
	public get size(): number {
		return this.locks.size;
	}

	/**
	 * Ensure `timeout` is in the accepted range.
	 *
	 * @param label   Label.
	 * @param timeout Number of ms to wait until forcibly reject mutex's promise.
	 */
	private static assertTimeout<Label>(label: Label, timeout: Milliseconds): never | true {
		const minTimeout = 0;
		if (timeout <= minTimeout) {
			throw createException(ErrorCodes.INVALID_ARGUMENT, `Timeout can't be lower or equal to ${minTimeout} ms. Given: ${timeout}. Label: '${label}'.`);
		}
		return true;
	}

	private static assertLockedOperation(operation: LockedOperationType): void | never {
		switch (operation) {
			case LockedOperationType.READ:
			case LockedOperationType.WRITE:
				return;
			default:
				throw createException(ErrorCodes.INVALID_ARGUMENT, `Requested an unknown operation '${operation}'.`);
		}
	}

	/**
	 * The goal of this method is to ensure that a given client can wait on shared promise, used as
	 * a **synchronization primitive**.
	 *
	 * @param label     Label of the lock.
	 * @param acquired  Operation used when promise was locked.
	 * @param requested Operation used for acquiring the promise again.
	 */
	private static assertLockedOperationsOverlap<Label>(label: Label, acquired: LockedOperationType, requested: LockedOperationType): never | void {
		switch (acquired) {
			case LockedOperationType.WRITE:
				throw createException(
					ErrorCodes.UNABLE_TO_LOCK,
					`Lock acquired for label '${label}' on ${LabeledConditionalVariableManager.formatLockedOperation(
						acquired
					)} operation, which is an exclusive one. Given: ${LabeledConditionalVariableManager.formatLockedOperation(requested)}.`
				);

			case LockedOperationType.READ:
				if (requested !== LockedOperationType.READ) {
					throw createException(
						ErrorCodes.UNABLE_TO_LOCK,
						`Lock acquired for label '${label}' on ${LabeledConditionalVariableManager.formatLockedOperation(acquired)} operation. ` +
							`Only ${LabeledConditionalVariableManager.formatLockedOperation(LockedOperationType.READ)} operation can be requested. ` +
							`Given: ${LabeledConditionalVariableManager.formatLockedOperation(requested)}.`
					);
				}
				break;

			default:
				throw createException(ErrorCodes.INVALID_ARGUMENT, `Requested an unknown operation '${acquired}'.`);
		}
	}

	/**
	 * Format {@link LockedOperationType} bitwise enum into it's corresponding string representation.
	 *
	 * @param   operation Locked operation type.
	 *
	 * @returns           String representation.
	 */
	public static formatLockedOperation(operation: LockedOperationType): string {
		switch (operation) {
			case LockedOperationType.READ:
				return 'READ';
			case LockedOperationType.WRITE:
				return 'WRITE';
			default:
				throw createException(ErrorCodes.INVALID_ARGUMENT, `Requested an unknown operation '${operation}'.`);
		}
	}

	/**
	 * Format {@link AwaiterRole} enum into it's corresponding string representation.
	 *
	 * @param   role Awaiter role.
	 *
	 * @returns      String representation.
	 */
	public static formatAwaiterRole(role: AwaiterRole): string {
		switch (role) {
			case AwaiterRole.CONSUMER:
				return 'CONSUMER';
			case AwaiterRole.PRODUCER:
				return 'PRODUCER';
			default:
				throw createException(ErrorCodes.INVALID_ARGUMENT, `Awaiter role is not valid. Given: ${role}.`);
		}
	}
}

export { LabeledConditionalVariableManager, LockedOperationType, AwaiterRole };
export type { WaitStatus };

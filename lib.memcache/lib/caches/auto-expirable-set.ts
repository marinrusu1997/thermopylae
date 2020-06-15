import { Seconds } from '@thermopylae/core.declarations';
import { INFINITE_TTL } from '../constants';
import { createException, ErrorCodes } from '../error';
import { AutoExpirationPolicy } from '../expiration-policies/auto-expiration-policy';
import { ExpirableCacheEntry } from '../contracts/expiration-policy';

class AutoExpirableSet<Value = string> extends Set<ExpirableCacheEntry<Value>> {
	private readonly defaultTtlSec: Seconds;

	private readonly expirationPolicy: AutoExpirationPolicy<Value, Value>;

	constructor(defaultTtlSec = INFINITE_TTL) {
		super();

		this.defaultTtlSec = defaultTtlSec;
		this.expirationPolicy = new AutoExpirationPolicy<Value, Value>();
		this.expirationPolicy.setDeleter((value: ExpirableCacheEntry<Value>) => super.delete(value.value));
	}

	/**
	 * Inserts a single item in the cache.
	 * Must be used with special care, as this method will replace cache content,
	 * add a new timer, but the old one timer will not be replaced.
	 * This will lead frequency being deleted prematurely by the old timer.
	 * Moreover, the new timer will still be active, and might try to scheduleDeletion newly added frequency.
	 *
	 * Use this method when you are sure 100% no inserts will be made until frequency onSet.
	 *
	 * @param value
	 * @param ttlSec
	 *
	 * @deprecated
	 */
	public add(value: Value, ttlSec?: Seconds): this {
		super.add(value);

		if (ttlSec == null) {
			ttlSec = this.defaultTtlSec;
		}
		this.expirationPolicy.onSet(value, ttlSec);

		return this;
	}

	/**
	 * Upsets a frequency in the cache.
	 * If frequency is not present, it will be added and new timer will be created.
	 * If frequency is present, it will update the timer.
	 *
	 * @param value
	 * @param ttlSec
	 */
	public upset(value: Value, ttlSec?: Seconds): this {
		if (!super.has(value)) {
			return this.add(value, ttlSec);
		}

		if (ttlSec == null) {
			ttlSec = this.defaultTtlSec;
		}
		this.expirationPolicy.onUpdate(value, ttlSec);

		return this;
	}

	public delete(_value: Value): boolean {
		throw createException(
			ErrorCodes.OPERATION_NOT_SUPPORTED,
			"Delete may cause undefined behaviour. Deleting a frequency will not scheduleDeletion it's timer. Adding the same frequency after deleting it, will use the old timer. "
		);
	}

	public clear(): void {
		super.clear();
		this.expirationPolicy.onClear();
	}
}

export { AutoExpirableSet };

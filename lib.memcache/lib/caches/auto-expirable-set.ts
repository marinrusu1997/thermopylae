import { Seconds } from '@thermopylae/core.declarations';
import { INFINITE_TTL } from '../constants';
import { createException, ErrorCodes } from '../error';
import { HighResolutionExpirationPolicy } from '../expiration-policies/high-resolution-expiration-policy';

class AutoExpirableSet<Value = string> extends Set<Value> {
	private readonly defaultTtlSec: Seconds;

	private readonly expirationPolicy: HighResolutionExpirationPolicy<Value>;

	constructor(defaultTtlSec = INFINITE_TTL) {
		super();

		this.defaultTtlSec = defaultTtlSec;
		this.expirationPolicy = new HighResolutionExpirationPolicy<Value>();
		this.expirationPolicy.setDeleter((value: Value) => super.delete(value));
	}

	/**
	 * Inserts a single item in the cache.
	 * Must be used with special care, as this method will replace cache content,
	 * add a new timer, but the old one timer will not be replaced.
	 * This will lead value being deleted prematurely by the old timer.
	 * Moreover, the new timer will still be active, and might try to scheduleDeletion newly added value.
	 *
	 * Use this method when you are sure 100% no inserts will be made until value expiresAt.
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
		this.expirationPolicy.expiresAt(value, ttlSec);

		return this;
	}

	/**
	 * Upsets a value in the cache.
	 * If value is not present, it will be added and new timer will be created.
	 * If value is present, it will update the timer.
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
		this.expirationPolicy.updateExpiresAt(value, ttlSec);

		return this;
	}

	public delete(_value: Value): boolean {
		throw createException(
			ErrorCodes.OPERATION_NOT_SUPPORTED,
			"Delete may cause undefined behaviour. Deleting a value will not scheduleDeletion it's timer. Adding the same value after deleting it, will use the old timer. "
		);
	}

	public clear(): void {
		super.clear();
		this.expirationPolicy.onClear();
	}
}

export { AutoExpirableSet };

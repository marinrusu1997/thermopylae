import { Seconds } from '@thermopylae/core.declarations';
import { INFINITE_TTL } from '../cache';
import { HighResolutionGarbageCollector } from '../high-resolution-garbage-collector';
import { createException, ErrorCodes } from '../error';

class AutoExpirableSet<T = string> extends Set<T> {
	private readonly defaultTtlSec: Seconds;

	private readonly gc: HighResolutionGarbageCollector<T>;

	constructor(defaultTtlSec = INFINITE_TTL) {
		super();

		this.defaultTtlSec = defaultTtlSec;
		this.gc = new HighResolutionGarbageCollector<T>(value => super.delete(value));
	}

	/**
	 * Inserts a single item in the cache.
	 * Must be used with special care, as this method will replace cache content,
	 * add a new timer, but the old one timer will not be replaced.
	 * This will lead value being deleted prematurely by the old timer.
	 * Moreover, the new timer will still be active, and might try to scheduleDeletion newly added value.
	 *
	 * Use this method when you are sure 100% no inserts will be made until value expires.
	 *
	 * @param value
	 * @param ttlSec
	 *
	 * @deprecated
	 */
	public add(value: T, ttlSec?: Seconds): this {
		super.add(value);

		if (ttlSec == null) {
			ttlSec = this.defaultTtlSec;
		}
		this.gc.scheduleDeletion(value, ttlSec);

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
	public upset(value: T, ttlSec?: Seconds): this {
		if (!super.has(value)) {
			return this.add(value, ttlSec);
		}

		if (ttlSec == null) {
			ttlSec = this.defaultTtlSec;
		}
		this.gc.reScheduleDeletion(value, ttlSec);

		return this;
	}

	public delete(_value: T): boolean {
		throw createException(
			ErrorCodes.DELETE_NOT_ALLOWED,
			"Delete may cause undefined behaviour. Deleting a value will not scheduleDeletion it's timer. Adding the same value after deleting it, will use the old timer. "
		);
	}

	public clear(): void {
		super.clear();
		this.gc.stop();
	}
}

export { AutoExpirableSet };

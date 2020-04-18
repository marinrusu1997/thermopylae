import { GarbageCollector, INFINITE_TTL } from './garbage-collector';
import { createException, ErrorCodes } from './error';

type Seconds = number;

class MemSetCache<T = string> extends Set<T> {
	private readonly defaultTtlSec: Seconds;

	private readonly gc: GarbageCollector<T>;

	constructor(defaultTtlSec = INFINITE_TTL) {
		super();

		this.defaultTtlSec = defaultTtlSec;
		this.gc = new GarbageCollector<T>(value => super.delete(value));
	}

	add(value: T, ttlSec?: Seconds): this {
		super.add(value);

		ttlSec = ttlSec != null ? ttlSec : this.defaultTtlSec;
		if (ttlSec > INFINITE_TTL) {
			this.gc.track(value, ttlSec);
		}

		return this;
	}

	delete(_value: T): boolean {
		throw createException(
			ErrorCodes.DELETE_NOT_ALLOWED,
			"Delete may cause undefined behaviour. Deleting a value will not delete it's timer. Adding the same value after deleting it, will use the old timer. "
		);
	}

	clear(): void {
		super.clear();
		this.gc.stop();
	}
}

export { MemSetCache };

import { Nullable, Runnable, Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { chrono } from '@thermopylae/lib.utils';

interface EvictionInterval {
	timeoutId: Nullable<NodeJS.Timeout>;
	willTickOn: UnixTimestamp;
}

// @fixme no tests
class EvictionTimer {
	private readonly evictionInterval: EvictionInterval;

	private readonly onTick: Runnable;

	public constructor(onTick: Runnable) {
		this.evictionInterval = {
			timeoutId: null,
			willTickOn: -1
		};
		this.onTick = onTick;
	}

	public get idle(): boolean {
		return this.evictionInterval.timeoutId == null;
	}

	public startAt(startTimestamp: UnixTimestamp): void {
		this.evictionInterval.willTickOn = startTimestamp;
		this.evictionInterval.timeoutId = setTimeout(this.onTick, chrono.secondsToMilliseconds(startTimestamp - chrono.unixTime()));
	}

	public startAfter(timeout: Seconds, now: UnixTimestamp): void {
		this.evictionInterval.willTickOn = now + timeout;
		this.evictionInterval.timeoutId = setTimeout(this.onTick, chrono.secondsToMilliseconds(timeout));
	}

	public synchronize(withTimestamp: UnixTimestamp): void {
		if (this.evictionInterval.willTickOn > withTimestamp) {
			this.stop();
			this.startAt(withTimestamp);
		}
	}

	public restart(startTimestamp: UnixTimestamp): void {
		if (this.evictionInterval.timeoutId == null) {
			this.startAt(startTimestamp);
			return;
		}

		this.synchronize(startTimestamp);
	}

	public stop(): void {
		clearTimeout(this.evictionInterval.timeoutId!);
		this.evictionInterval.timeoutId = null;
		this.evictionInterval.willTickOn = -1;
	}
}

export { EvictionTimer };

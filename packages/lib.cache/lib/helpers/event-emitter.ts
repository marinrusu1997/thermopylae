import { EventEmitter } from 'events';
import { CacheEventEmitterInterface, CacheEventListener, CacheEvent } from '../contracts/cache-event-emitter';

class CacheEventEmitter<Key, Value> implements CacheEventEmitterInterface<Key, Value> {
	private emitter!: EventEmitter;

	private internalEventsMask!: CacheEvent;

	public get eventMask(): CacheEvent {
		return this.internalEventsMask;
	}

	public set eventMask(mask: CacheEvent) {
		this.internalEventsMask = mask;
		if (this.emitter == null) {
			this.emitter = new EventEmitter();
		}
	}

	public on(event: CacheEvent, listener: CacheEventListener<Key, Value>): boolean {
		if (event === (this.internalEventsMask & event)) {
			this.emitter!.on((event as unknown) as string, listener);
			return true;
		}
		return false;
	}

	public off(event: CacheEvent, listener: CacheEventListener<Key, Value>): boolean {
		if (event === (this.internalEventsMask & event)) {
			this.emitter!.off((event as unknown) as string, listener);
			return true;
		}
		return false;
	}

	public emit(event: CacheEvent, key?: Key, value?: Value): boolean {
		if (event === (this.internalEventsMask & event)) {
			return this.emitter!.emit((event as unknown) as string, key, value);
		}
		return false;
	}
}

export { CacheEventEmitter };

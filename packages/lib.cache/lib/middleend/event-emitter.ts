import { EventEmitter } from 'events';
import { CacheEventEmitter, CacheEventListener, CacheEventType } from '../contracts/cache-event-emitter';

class MiddleEndEventEmitter<Key, Value> implements CacheEventEmitter<Key, Value> {
	private emitter!: EventEmitter;

	private internalEventsMask!: CacheEventType;

	public get eventMask(): CacheEventType {
		return this.internalEventsMask;
	}

	public set eventMask(mask: CacheEventType) {
		this.internalEventsMask = mask;
		if (this.emitter == null) {
			this.emitter = new EventEmitter();
		}
	}

	public on(event: CacheEventType, listener: CacheEventListener<Key, Value>): boolean {
		if (event === (this.internalEventsMask & event)) {
			this.emitter!.on((event as unknown) as string, listener);
			return true;
		}
		return false;
	}

	public off(event: CacheEventType, listener: CacheEventListener<Key, Value>): boolean {
		if (event === (this.internalEventsMask & event)) {
			this.emitter!.off((event as unknown) as string, listener);
			return true;
		}
		return false;
	}

	public emit(event: CacheEventType, key?: Key, value?: Value): boolean {
		if (event === (this.internalEventsMask & event)) {
			return this.emitter!.emit((event as unknown) as string, key, value);
		}
		return false;
	}
}

export { MiddleEndEventEmitter };

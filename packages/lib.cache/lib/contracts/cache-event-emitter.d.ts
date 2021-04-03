/**
 * Event emitted by {@link CacheMiddleEnd}.
 */
declare const enum CacheEvent {
	INSERT = 1 << 0,
	UPDATE = 1 << 1,
	DELETE = 1 << 2,
	FLUSH = 1 << 3
}

/**
 * Event listener for {@link CacheEvent}.
 *
 * @template Key	Type of the key.
 * @template Value	Type of the value.
 */
declare type CacheEventListener<Key, Value> = (key?: Key, value?: Value) => void;

interface CacheEventEmitter<Key, Value> {
	/**
	 * Event mask that controls which events needs to be emitted. <br/>
	 * ** This property needs to be set with an according value before registering listeners. **
	 */
	eventMask: CacheEvent;

	/**
	 * Register *listener* for *event*.
	 *
	 * @param event		Event type.
	 * @param listener	Event listener.
	 *
	 * @returns         Whether the listener was successfully registered.
	 */
	on(event: CacheEvent, listener: CacheEventListener<Key, Value>): boolean;

	/**
	 * Unregister *listener* for *event*.
	 *
	 * @param event     Event type.
	 * @param listener  Event listener.
	 *
	 * @returns         Whether the listener was successfully unregistered.
	 */
	off(event: CacheEvent, listener: CacheEventListener<Key, Value>): boolean;

	/**
	 * Emit events with arguments. <br/>
	 * **This method should be called only by *cache* and not by clients.**
	 *
	 * @param event     Event type.
	 * @param key       Key that triggered event.
	 * @param value     Key associated value.
	 *
	 * @returns         Whether the *event* has been emitted.
	 */
	emit(event: CacheEvent, key?: Key, value?: Value): boolean;
}

export { CacheEvent, CacheEventListener, CacheEventEmitter };

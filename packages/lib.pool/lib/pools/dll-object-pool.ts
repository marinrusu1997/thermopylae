import DLL, { create, Node as DLLObjectPoolHandle } from 'yallist';
import { Undefinable } from '@thermopylae/core.declarations';
import { createException, ErrorCodes } from '../exception';

type ObjectConstructor<Value> = (...args: Array<any>) => Value;
type ObjectInitializer<Value> = (resource: Undefinable<Value>, ...args: Array<any>) => Value;
type ObjectDestructor<Value> = (resource: Undefinable<Value>) => Undefinable<Value>;

interface DLLObjectPoolStats {
	/**
	 * Number of available object resources.
	 */
	free: number;
	/**
	 * Number of used object resources.
	 */
	used: number;
}

interface DLLObjectPoolOptions<Value> {
	/**
	 * Capacity of the poll which represents the number of available objects. <br/>
	 * When number of used objects goes beyond *capacity*, and exception will be thrown,
	 * preventing acquiring new resources.
	 */
	capacity: number;
	/**
	 * Function called when an object resource is acquired for the first time.
	 */
	constructor: ObjectConstructor<Value>;
	/**
	 * Function called when an object resource is free and needs to be reused (i.e. acquired again).
	 */
	initializer: ObjectInitializer<Value>;
	/**
	 * Function called when an object resource is released.
	 */
	destructor: ObjectDestructor<Value>;
	/**
	 * Array of pre-allocated object resources used by {@link DLLObjectPool} from it's creation.
	 */
	initialFreeShapes?: Array<Undefinable<Value>>;
}

class DLLObjectPool<Value> {
	private readonly config: DLLObjectPoolOptions<Value>;

	private readonly free: DLL<Undefinable<Value>>;

	private readonly used: DLL<Undefinable<Value>>;

	public constructor(config: DLLObjectPoolOptions<Value>) {
		this.config = DLLObjectPool.assertConfig(config);
		this.free = create(config.initialFreeShapes || []);
		this.used = create();

		delete config.initialFreeShapes;
	}

	/**
	 * Preempts an object resource which initially wasn't managed by this {@link DLLObjectPool}.
	 *
	 * @param object	Object resource.
	 *
	 * @returns			Handle to object resource.
	 */
	public preempt(object: Value): DLLObjectPoolHandle<Value> {
		this.used.push(object);
		return this.used.tail as DLLObjectPoolHandle<Value>; // there is a value
	}

	/**
	 * Acquire a new object resource from pool.
	 *
	 * @param args	Arguments forwarded to object:
	 * 					- constructor (when resource is acquired for the first time)
	 * 					- initialized (when resource is reused)
	 *
	 * @throws {Exception}	When number of used resources goes beyond {@link DLLObjectPoolOptions.capacity}.
	 *
	 * @returns		Internal handle to object resource.
	 */
	public acquire(...args: Array<any>): DLLObjectPoolHandle<Value> {
		if (this.free.head != null) {
			this.free.head.value = this.config.initializer(this.free.head.value, ...args);
			this.used.pushNode(this.free.head);
		} else {
			if (this.used.length >= this.config.capacity) {
				// because length starts from 0 we use >=
				throw createException(ErrorCodes.LIMIT_REACHED, `Limit of ${this.config.capacity} has been reached.`);
			}

			this.used.push(this.config.constructor(...args));
		}

		return this.used.tail as DLLObjectPoolHandle<Value>; // there is a value
	}

	/**
	 * Release handle to object resource.
	 *
	 * @param handle	Handle to object resource.
	 */
	public releaseHandle(handle: DLLObjectPoolHandle<Undefinable<Value>>): void {
		handle.value = this.config.destructor(handle.value);
		this.free.pushNode(handle);
	}

	/**
	 * Release object resource <br/>
	 * This method has O(n) complexity, because we need to find according handle
	 * for that object resource before performing release.
	 *
	 * @param object	Object resource.
	 */
	public releaseObject(object: Value): void {
		let handle = this.used.head;
		while (handle) {
			if (handle.value === object) {
				return this.releaseHandle(handle);
			}
			handle = handle.next;
		}
		throw createException(ErrorCodes.INVALID_PARAM, 'Provided object is not managed by pool.', object);
	}

	/**
	 * Release all object resources. <br/>
	 * This method has O(n) complexity, because it needs to iterate over all used resources to free them.
	 */
	public releaseAll(): void {
		while (this.used.head != null) {
			this.used.head.value = this.config.destructor(this.used.head.value);
			this.free.pushNode(this.used.head);
		}
	}

	/**
	 * Get object pool statistics about free and used resources.
	 */
	public get stats(): DLLObjectPoolStats {
		return {
			free: this.free.length,
			used: this.used.length
		};
	}

	/**
	 * Obtain value of the handle to object resource.
	 *
	 * @param handle	Handle to object resource.
	 *
	 * @returns			Object resource from the handle.
	 */
	public static value<V>(handle: DLLObjectPoolHandle<V>): V {
		return handle.value;
	}

	private static assertConfig<V>(config: DLLObjectPoolOptions<V>): DLLObjectPoolOptions<V> | never {
		const minCapacity = 0;
		if (config.capacity <= minCapacity) {
			throw createException(ErrorCodes.INVALID_PARAM, `Capacity needs to be greater than ${minCapacity}. Given: ${config.capacity}.`);
		}
		if (config.initialFreeShapes != null && config.initialFreeShapes.length === minCapacity) {
			throw createException(ErrorCodes.INVALID_PARAM, `Initial free shapes collection has to contain at least ${minCapacity + 1}.`);
		}
		return config;
	}
}

export { DLLObjectPool, DLLObjectPoolOptions, DLLObjectPoolStats, ObjectConstructor, ObjectDestructor, ObjectInitializer, DLLObjectPoolHandle };

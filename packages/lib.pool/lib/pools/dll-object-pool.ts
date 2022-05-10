import DLL from 'yallist';
import type { Node as DLLObjectPoolHandle } from 'yallist';
import type { ObjMap, Undefinable } from '@thermopylae/core.declarations';
import { createException, ErrorCodes } from '../error';

/**
 * Function which constructs the object when given a set of arguments. <br/>
 * After object has been created, it needs to be returned back.
 */
type ObjectConstructor<Value> = (...args: Array<any>) => Value;

/**
 * Function which initializes object with new values (i.e. overwrites the object). <br/>
 * Function can do anything he want with object, such as removing properties, adding new ones, overwrite with new values etc. <br/>
 * After object has been initialized, it needs to be returned back.
 */
type ObjectInitializer<Value> = (resource: Undefinable<Value>, ...args: Array<any>) => Value;

/**
 * Function called to destruct object. <br/>
 * Usually such a function will nullify object values, allowing GC to collect them.
 * It might also free external hold resources, such as file descriptors, tcp connections etc. <br/>
 * After object has been destructed, it needs to be returned back.
 */
type ObjectDestructor<Value> = (resource: Undefinable<Value>) => Undefinable<Value>;

/**
 * Collection of pool statistics.
 */
interface DLLObjectPoolStats {
	/**
	 * Number of available object resources.
	 */
	readonly free: number;
	/**
	 * Number of used object resources.
	 */
	readonly used: number;
}

interface DLLObjectPoolOptions<Value> {
	/**
	 * Capacity of the poll which represents the number of available objects. <br/>
	 * When number of used objects goes beyond *capacity*, and exception will be thrown,
	 * preventing acquiring new resources.
	 */
	readonly capacity: number;
	/**
	 * Function called when an object resource is acquired for the first time.
	 */
	readonly constructor: ObjectConstructor<Value>;
	/**
	 * Function called when an object resource is free and needs to be reused (i.e. acquired again).
	 */
	readonly initializer: ObjectInitializer<Value>;
	/**
	 * Function called when an object resource is released.
	 */
	readonly destructor: ObjectDestructor<Value>;
	/**
	 * Array of pre-allocated object resources used by {@link DLLObjectPool} at it's creation.
	 */
	initialFreeShapes?: Array<Undefinable<Value>>;
}

/**
 * Class which manages a pool of object resources. <br/>
 * Internal implementation is based on 2 Doubly Linked Lists, one for free resources, and another for used ones.
 */
class DLLObjectPool<Value = ObjMap> {
	private readonly config: DLLObjectPoolOptions<Value>;

	private readonly free: DLL<Undefinable<Value>>;

	private readonly used: DLL<Undefinable<Value>>;

	public constructor(config: DLLObjectPoolOptions<Value>) {
		this.config = DLLObjectPool.assertConfig(config);
		this.free = DLL.create(config.initialFreeShapes || []);
		this.used = DLL.create();

		delete config.initialFreeShapes;
	}

	/**
	 * Preempts an object resource which initially wasn't managed by this {@link DLLObjectPool}. <br/>
	 * After preemption, object will be put into used resources list. <br/>
	 * **This operation has O(1) complexity.**
	 *
	 * @param object	Object resource.
	 *
	 * @returns			Handle to object resource that was preempted.
	 */
	public preempt(object: Value): Readonly<DLLObjectPoolHandle<Value>> {
		this.used.push(object);
		return this.used.tail as DLLObjectPoolHandle<Value>; // there is a value
	}

	/**
	 * Acquire a new object resource from pool. <br/>
	 * **This operation has O(1) complexity.**
	 *
	 * @param args			Arguments forwarded to object:
	 * 							- constructor (when resource is acquired for the first time)
	 * 							- initializer (when resource is reused)
	 *
	 * @throws {Exception}	When number of used resources goes beyond {@link DLLObjectPoolOptions.capacity}.
	 *
	 * @returns				Handle to object resource.
	 */
	public acquire(...args: Array<any>): Readonly<DLLObjectPoolHandle<Value>> {
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
	 * Release handle to object resource. <br/>
	 * **This operation has O(1) complexity.**
	 *
	 * @param handle	Handle to object resource.
	 */
	public releaseHandle(handle: DLLObjectPoolHandle<Undefinable<Value>>): void {
		handle.value = this.config.destructor(handle.value);
		this.free.pushNode(handle);
	}

	/**
	 * Release object resource <br/>
	 * **This method has O(n) complexity**, because we need to find according handle
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
	 * **This method has O(n) complexity**, because it needs to iterate over all used resources
	 * to free them (i.e. call their destructors).
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

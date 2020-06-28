import DLL, { create, Node as Handle } from 'yallist';
import { Undefinable } from '@thermopylae/core.declarations';
import { createException, ErrorCodes } from '../exception';

type ObjectConstructor<Value> = (...args: Array<any>) => Value;
type ObjectInitializer<Value> = (previous: Undefinable<Value>, ...args: Array<any>) => Value;
type ObjectDestructor<Value> = (previous: Undefinable<Value>) => Undefinable<Value>;

interface ObjectPoolConfig<Value> {
	capacity: number;
	constructor: ObjectConstructor<Value>;
	initializer: ObjectInitializer<Value>;
	destructor: ObjectDestructor<Value>;
	initialFreeShapes?: Array<Undefinable<Value>>;
}

interface ObjectPoolStats {
	free: number;
	used: number;
}

class ObjectPool<Value> {
	private readonly config: ObjectPoolConfig<Value>;

	private readonly free: DLL<Undefinable<Value>>;

	private readonly used: DLL<Undefinable<Value>>;

	constructor(config: ObjectPoolConfig<Value>) {
		this.config = ObjectPool.assertConfig(config);
		this.free = create(config.initialFreeShapes || []);
		this.used = create();

		delete config.initialFreeShapes;
	}

	public preempt(object: Value): Handle<Value> {
		this.used.push(object);
		return this.used.tail as Handle<Value>; // there is a value
	}

	public acquire(...args: Array<any>): Handle<Value> {
		if (this.free.head != null) {
			this.free.head.value = this.config.initializer(this.free.head.value, ...args);
			this.used.pushNode(this.free.head);
		} else {
			if (this.used.length >= this.config.capacity) {
				throw createException(ErrorCodes.LIMIT_REACHED, `Limit of ${this.config.capacity} has been reached.`);
			}

			this.used.push(this.config.constructor(...args));
		}

		return this.used.tail as Handle<Value>; // there is a value
	}

	public releaseHandle(handle: Handle<Undefinable<Value>>): void {
		handle.value = this.config.destructor(handle.value);
		this.free.pushNode(handle);
	}

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

	public releaseAll(): void {
		while (this.used.head != null) {
			this.used.head.value = this.config.destructor(this.used.head.value);
			this.free.pushNode(this.used.head);
		}
	}

	public get stats(): ObjectPoolStats {
		return {
			free: this.free.length,
			used: this.used.length
		};
	}

	public static value<V>(handle: Handle<V>): V {
		return handle.value;
	}

	private static assertConfig<V>(config: ObjectPoolConfig<V>): ObjectPoolConfig<V> | never {
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

export { ObjectPool, ObjectPoolConfig, ObjectConstructor, ObjectDestructor, ObjectInitializer, ObjectPoolStats, Handle };

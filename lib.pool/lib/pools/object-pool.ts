import DLL, { create, Node as Handle } from 'yallist';
import { createException, ErrorCodes } from '../exception';

type ObjectConstructor<Value> = (...args: Array<any>) => Value;
type ObjectInitializer<Value> = (object: Value, ...args: Array<any>) => void;
type ObjectDestructor<Value> = (object: Value) => any;

interface ObjectPoolConfig<Value> {
	capacity: number;
	constructor: ObjectConstructor<Value>;
	initializer: ObjectInitializer<Value>;
	destructor: ObjectDestructor<Value>;
	initialFreeShapes?: Array<Value>;
}

interface ObjectPoolStats {
	free: number;
	used: number;
}

class ObjectPool<Value> {
	private readonly config: ObjectPoolConfig<Value>;

	private readonly free: DLL<Value>;

	private readonly used: DLL<Value>;

	constructor(config: ObjectPoolConfig<Value>) {
		this.config = ObjectPool.assertConfig(config);
		this.free = create(config.initialFreeShapes || []);
		this.used = create();

		delete config.initialFreeShapes;
	}

	public preempt(object: Value): Handle<Value> {
		this.used.push(object);
		return this.used.tail!;
	}

	public acquire(...args: Array<any>): Handle<Value> {
		if (this.free.head != null) {
			this.config.initializer(this.free.head.value, ...args);
			this.used.pushNode(this.free.head);
		} else {
			if (this.used.length >= this.config.capacity) {
				throw createException(ErrorCodes.LIMIT_REACHED, `Limit of ${this.config.capacity} has been reached.`);
			}

			this.used.push(this.config.constructor(...args));
		}

		return this.used.tail!;
	}

	public release(handle: Handle<Value>): any {
		this.free.pushNode(handle);
		return this.config.destructor(handle.value);
	}

	public releaseAll(): Array<any> {
		if (!this.used.length) {
			return [];
		}

		const destructorsResult = new Array<any>(this.used.length);
		let i = 0;
		while (this.used.head != null) {
			destructorsResult[i++] = this.config.destructor(this.used.head.value);
			this.free.pushNode(this.used.head);
		}

		return destructorsResult;
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

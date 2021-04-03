import { createException, ErrorCodes } from '../exception';

/**
 * Function called in order to initialize *resource* with *values* provided on acquisition.
 */
type ObjectInitializer<Value> = (resource: Value, values: Array<any>) => void;
/**
 * Function called in order to de-initialize *resource* when it is released.
 */
type ObjectDeInitializer<Value> = (resource: Value) => void;

interface ObjectResource<Value> {
	/**
	 * Position of the resource in the pool. <br/>
	 * Managed by {@link ArrayObjectPool}.
	 */
	index: number;
	/**
	 * Value of the resource.
	 */
	value: Value;
}

interface ArrayObjectPoolOptions<Value> {
	/**
	 * Capacity of the poll. <br/>
	 * When *capacity* is not given, pool resources will grow dynamically with the clients needs,
	 * unless there is no available memory.
	 */
	capacity?: number;
	/**
	 * Function called in order to initialize *resource*.
	 */
	initializer: ObjectInitializer<Value>;
	/**
	 * Function called when an object resource is released.
	 */
	deInitializer: ObjectDeInitializer<Value>;
}

/**
 * Pool of object resources. The internal implementation keeps resources into {@link Array}.
 *
 * @template T	Type of the object.
 */
class ArrayObjectPool<T extends Record<any, any> = Record<string, any>> {
	private readonly options: ArrayObjectPoolOptions<T>;

	private readonly resources: Array<ObjectResource<T>>;

	private freeResourcesRegionBeginIndex: number;

	public constructor(options: ArrayObjectPoolOptions<T>) {
		this.options = ArrayObjectPool.assertOptions(options);
		this.freeResourcesRegionBeginIndex = 0;

		if (options.capacity) {
			this.resources = new Array<ObjectResource<T>>(options.capacity);
			for (let i = 0; i < options.capacity; i++) {
				this.resources[i] = {
					index: i,
					value: {} as T
				};
			}
		} else {
			this.resources = [];
		}
	}

	/**
	 * Get number of free resources.
	 */
	public get free(): number {
		return this.resources.length - this.freeResourcesRegionBeginIndex;
	}

	/**
	 * Get number of used resources.
	 */
	public get used(): number {
		return this.freeResourcesRegionBeginIndex;
	}

	/**
	 * Acquire a new object resource from pool.
	 *
	 * @param args	Arguments forwarded to object initializer.
	 *
	 * @throws {Exception}	When number of used resources goes beyond {@link ArrayObjectPoolOptions.capacity}.
	 *
	 * @returns		Object resource.
	 */
	public acquire(...args: Array<any>): ObjectResource<T> {
		if (this.freeResourcesRegionBeginIndex === this.resources.length) {
			if (this.options.capacity) {
				throw createException(ErrorCodes.LIMIT_REACHED, `Limit of ${this.options.capacity} has been reached.`);
			}
			this.resources.push({ index: this.resources.length, value: {} as T });
		}

		const freeObjectResource = this.resources[this.freeResourcesRegionBeginIndex];
		this.options.initializer(freeObjectResource.value, args);

		this.freeResourcesRegionBeginIndex += 1;

		return freeObjectResource;
	}

	/**
	 * Release object resource.
	 *
	 * @param objectResource	Object resource.
	 */
	public release(objectResource: ObjectResource<T>): void {
		if (this.freeResourcesRegionBeginIndex - objectResource.index > 1) {
			this.swap(objectResource.index, this.freeResourcesRegionBeginIndex - 1);
		}

		this.options.deInitializer(objectResource.value);
		this.freeResourcesRegionBeginIndex -= 1;
	}

	/**
	 * Release all object resources. <br/>
	 * Notice that objects won't be de-allocated, only their destructors will be called.
	 */
	public releaseAll(): void {
		for (let i = 0; i < this.freeResourcesRegionBeginIndex; i++) {
			this.options.deInitializer(this.resources[i].value);
		}
		this.freeResourcesRegionBeginIndex = 0;
	}

	/**
	 * Clears the object resources pool. <br/>
	 * After this operation, pool should no longer be used.
	 */
	public clear(): void {
		this.resources.length = 0;
		this.freeResourcesRegionBeginIndex = -1;
	}

	private swap(firstIndex: number, secondIndex: number): void {
		const aux = this.resources[firstIndex];
		this.resources[firstIndex] = this.resources[secondIndex];
		this.resources[secondIndex] = aux;

		this.resources[firstIndex].index = firstIndex;
		this.resources[secondIndex].index = secondIndex;
	}

	private static assertOptions<V>(config: ArrayObjectPoolOptions<V>): ArrayObjectPoolOptions<V> | never {
		if (config.capacity) {
			if (!Number.isInteger(config.capacity)) {
				throw createException(ErrorCodes.INVALID_PARAM, `Capacity needs to be an integer. Given: ${config.capacity}.`);
			}
			if (config.capacity === Infinity) {
				throw createException(ErrorCodes.INVALID_PARAM, `Capacity can't be equal to infinity. Given: ${config.capacity}.`);
			}
		}

		return config;
	}
}

export { ArrayObjectPool, ArrayObjectPoolOptions, ObjectResource, ObjectInitializer, ObjectDeInitializer };

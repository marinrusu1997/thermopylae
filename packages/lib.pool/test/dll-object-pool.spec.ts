import { number, string, array } from '@thermopylae/lib.utils';
import { chai } from '@thermopylae/dev.unit-test';
// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it } from 'mocha';
import { Library, Nullable, Undefinable } from '@thermopylae/core.declarations';
import { Exception } from '@thermopylae/lib.exception';
import { DLLObjectPool, ObjectConstructor, ObjectDestructor, ObjectInitializer, DLLObjectPoolStats, DLLObjectPoolHandle } from '../lib/pools/dll-object-pool';
import { ErrorCodes } from '../lib';

const { expect } = chai;

interface ObjectShape {
	a: number;
	b: string;
}

const constructor: ObjectConstructor<ObjectShape> = (a: number, b: string): ObjectShape => ({ a, b });
const destructor: ObjectDestructor<ObjectShape> = () => clearedShape();
const initializer: ObjectInitializer<ObjectShape> = (shape, a: number, b: string) => {
	if (shape !== undefined) {
		shape.a = a;
		shape.b = b;
	} else {
		shape = constructor(a, b);
	}
	return shape;
};

function shapeArgs(): [number, string] {
	return [number.random(0, 100), string.random()];
}

function initialFreeShapes(quantity: number): Array<ObjectShape> {
	function filler(): ObjectShape {
		return constructor(...shapeArgs());
	}
	return array.filledWith(quantity, filler);
}

function objectPoolFactory(capacity: number, initial?: Array<ObjectShape>): DLLObjectPool<ObjectShape> {
	return new DLLObjectPool<ObjectShape>({
		initialFreeShapes: initial,
		capacity,
		constructor,
		destructor,
		initializer
	});
}

const enum Comparison {
	VALUE = 1 << 0,
	REFERENCE = 1 << 1
}
function equals(first: any, second: any, comparison: Comparison): boolean {
	let equal = true;

	function append(truthiness: boolean): void {
		equal = equal && truthiness;
	}

	if (comparison & Comparison.REFERENCE) {
		append(first === second);
	}

	if (comparison & Comparison.VALUE) {
		expect(first).to.be.deep.eq(second);
	}

	return equal;
}

function stats(free: number, used: number): DLLObjectPoolStats {
	return { free, used };
}

function clearedShape(): Undefinable<ObjectShape> {
	return undefined;
}

// eslint-disable-next-line mocha/no-setup-in-describe
describe(`${DLLObjectPool.name} spec`, () => {
	it('constructs pool with initial values, acquires, then releases them all', () => {
		const shapesNo = 10;
		const initialShapes = initialFreeShapes(shapesNo);

		const objectPool = objectPoolFactory(Infinity, initialShapes);
		expect(objectPool.stats).to.be.deep.eq(stats(shapesNo, 0));

		for (let usedNo = 0; usedNo < shapesNo; usedNo++) {
			const acquired = DLLObjectPool.value(objectPool.acquire(...shapeArgs()));
			expect(objectPool.stats).to.be.deep.eq(stats(shapesNo - usedNo - 1, usedNo + 1));

			expect(acquired === initialShapes[usedNo]).to.be.eq(true); // pedantic ref check
			expect(acquired).to.be.deep.eq(initialShapes[usedNo]); // initializer did his job
		}

		objectPool.releaseAll();
		expect(objectPool.stats).to.be.deep.eq(stats(shapesNo, 0));
	});

	it('fails to construct poll when capacity is lower or equal to 0', () => {
		expect(() => objectPoolFactory(0)).to.throw(`Capacity needs to be greater than ${0}. Given: ${0}.`);
		let err;
		try {
			objectPoolFactory(-1);
		} catch (e) {
			err = e;
		}
		expect(err.emitter).to.be.eq(Library.POOL);
		expect(err.code).to.be.eq(ErrorCodes.INVALID_PARAM);
		expect(err.message).to.be.eq(`Capacity needs to be greater than ${0}. Given: ${-1}.`);
		expect(err.cause).to.be.eq(undefined);
	});

	it('fails to construct poll when initial free shapes are empty', () => {
		expect(() => objectPoolFactory(Infinity, [])).to.throw(`Initial free shapes collection has to contain at least ${1}.`);
	});

	it('acquires object', () => {
		const objectPool = objectPoolFactory(Infinity);
		const args = shapeArgs();

		const actual = objectPool.acquire(...args);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));

		const expected = constructor(...args);
		expect(equals(DLLObjectPool.value(actual), expected, Comparison.VALUE)).to.be.eq(true);
	});

	it('acquires from free list', () => {
		const initial = initialFreeShapes(1);
		const objectPool = objectPoolFactory(1, initial);
		expect(objectPool.stats).to.be.deep.eq(stats(1, 0));
		const args = shapeArgs();

		const actual = objectPool.acquire(...args);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));

		const expected = constructor(...args);
		expect(equals(DLLObjectPool.value(actual), expected, Comparison.VALUE)).to.be.eq(true);
		expect(equals(DLLObjectPool.value(actual), initial[0], Comparison.VALUE | Comparison.REFERENCE)).to.be.eq(true);
	});

	it('acquires by creating new object', () => {
		const initial = initialFreeShapes(1);
		const objectPool = objectPoolFactory(2, initial);
		expect(objectPool.stats).to.be.deep.eq(stats(1, 0));
		const args = shapeArgs();

		const recycled = objectPool.acquire(...args);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));

		const expected = constructor(...args);
		expect(equals(DLLObjectPool.value(recycled), expected, Comparison.VALUE)).to.be.eq(true);
		expect(equals(DLLObjectPool.value(recycled), initial[0], Comparison.VALUE | Comparison.REFERENCE)).to.be.eq(true);

		const created = objectPool.acquire(...args);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 2));
		expect(equals(DLLObjectPool.value(created), expected, Comparison.VALUE)).to.be.eq(true);

		expect(equals(recycled, created, Comparison.REFERENCE)).to.be.eq(false);
		expect(equals(DLLObjectPool.value(created), DLLObjectPool.value(recycled), Comparison.REFERENCE)).to.be.eq(false);
	});

	it('releases handle', () => {
		const objectPool = objectPoolFactory(Infinity);
		const args = shapeArgs();

		const acquired = objectPool.acquire(...args);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));

		objectPool.releaseHandle(acquired);
		expect(objectPool.stats).to.be.deep.eq(stats(1, 0));

		expect(DLLObjectPool.value(acquired));
	});

	it('releases object', () => {
		const objectPool = objectPoolFactory(Infinity);
		const args = shapeArgs();

		const acquired = objectPool.acquire(...args);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));
		expect(DLLObjectPool.value(acquired)).to.be.deep.eq(constructor(...args));

		objectPool.releaseObject(DLLObjectPool.value(acquired));
		expect(objectPool.stats).to.be.deep.eq(stats(1, 0));

		const reargs = shapeArgs();
		const reacquired = objectPool.acquire(...reargs);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));
		expect(DLLObjectPool.value(reacquired)).to.be.deep.eq(constructor(...reargs));
		expect(DLLObjectPool.value(reacquired)).to.not.be.deep.eq(constructor(...args));
	});

	it('fails to release object not managed by pool', () => {
		const objectPool = objectPoolFactory(Infinity);
		const args = shapeArgs();

		const acquiredFirst = objectPool.acquire(...args);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));
		expect(DLLObjectPool.value(acquiredFirst)).to.be.deep.eq(constructor(...args));

		const acquiredSecond = objectPool.acquire(...args);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 2));
		expect(DLLObjectPool.value(acquiredSecond)).to.be.deep.eq(constructor(...args));

		const toRelease = {};
		let err: Nullable<Exception> = null;
		try {
			// @ts-ignore For testing purposes
			objectPool.releaseObject(toRelease);
		} catch (e) {
			err = e;
		}

		if (err == null) {
			throw new Error("releaseObject didn't threw an error.");
		}

		expect(objectPool.stats).to.be.deep.eq(stats(0, 2));

		expect(err.emitter).to.be.eq(Library.POOL);
		expect(err.code).to.be.eq(ErrorCodes.INVALID_PARAM);
		expect(err.message).to.be.eq('Provided object is not managed by pool.');
		expect(equals(err.origin, toRelease, Comparison.REFERENCE | Comparison.VALUE)).to.be.eq(true);
	});

	it('releases nothing if there are no objects', () => {
		const objectPool = objectPoolFactory(Infinity);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 0));
		objectPool.releaseAll();
		expect(objectPool.stats).to.be.deep.eq(stats(0, 0));
	});

	it('preempts object', () => {
		const objectPool = objectPoolFactory(Infinity);
		const object = constructor(...shapeArgs());

		const preempted = objectPool.preempt(object);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));
		expect(equals(DLLObjectPool.value(preempted), object, Comparison.VALUE | Comparison.REFERENCE)).to.be.eq(true);

		objectPool.releaseHandle(preempted);
		expect(objectPool.stats).to.be.deep.eq(stats(1, 0));
		expect(equals(DLLObjectPool.value(preempted), clearedShape(), Comparison.VALUE)).to.be.eq(true);
	});

	it('reuses nodes', () => {
		const objectPool = objectPoolFactory(Infinity);

		const firstArgs = shapeArgs();
		const secondArgs = shapeArgs();

		const acquiredFirst = objectPool.acquire(...firstArgs);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));
		expect(DLLObjectPool.value(acquiredFirst)).to.be.deep.eq(constructor(...firstArgs));

		objectPool.releaseHandle(acquiredFirst);
		expect(objectPool.stats).to.be.deep.eq(stats(1, 0));

		const acquiredSecond = objectPool.acquire(...secondArgs);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));
		expect(equals(acquiredFirst, acquiredSecond, Comparison.REFERENCE)).to.be.eq(true); // reused
		expect(DLLObjectPool.value(acquiredSecond)).to.be.deep.eq(constructor(...secondArgs));

		objectPool.releaseHandle(acquiredSecond);
		expect(objectPool.stats).to.be.deep.eq(stats(1, 0));
	});

	it('reuses initial nodes', () => {
		const initialNo = 10;
		const initial = initialFreeShapes(initialNo);
		const objectPool = objectPoolFactory(Infinity, initial);
		expect(objectPool.stats).to.be.deep.eq(stats(initial.length, 0));

		function reusedObjectFromInitialShapes(object: ObjectShape): boolean {
			for (let i = 0; i < initial.length; i++) {
				if (initial[i] === object) {
					initial.splice(i, 1);
					return true;
				}
			}
			return false;
		}

		const firstArgs = shapeArgs();
		const secondArgs = shapeArgs();

		const acquiredFirst = objectPool.acquire(...firstArgs);
		expect(objectPool.stats).to.be.deep.eq(stats(initialNo - 1, 1));
		expect(DLLObjectPool.value(acquiredFirst)).to.be.deep.eq(constructor(...firstArgs));
		expect(reusedObjectFromInitialShapes(DLLObjectPool.value(acquiredFirst))).to.be.eq(true);

		objectPool.releaseHandle(acquiredFirst);
		expect(objectPool.stats).to.be.deep.eq(stats(initialNo, 0));

		const acquiredSecond = objectPool.acquire(...secondArgs);
		expect(objectPool.stats).to.be.deep.eq(stats(initialNo - 1, 1));
		expect(DLLObjectPool.value(acquiredSecond)).to.be.deep.eq(constructor(...secondArgs));
		expect(reusedObjectFromInitialShapes(DLLObjectPool.value(acquiredSecond))).to.be.eq(true); // reused

		objectPool.releaseHandle(acquiredSecond);
		expect(objectPool.stats).to.be.deep.eq(stats(initialNo, 0));
	});

	it('reuses objects from nodes', () => {
		const objectPool = objectPoolFactory(Infinity);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 0));

		const firstArgs = shapeArgs();
		const secondArgs = shapeArgs();

		const acquiredFirst = objectPool.acquire(...firstArgs);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));
		expect(DLLObjectPool.value(acquiredFirst)).to.be.deep.eq(constructor(...firstArgs)); // constructed

		objectPool.releaseHandle(acquiredFirst);
		expect(objectPool.stats).to.be.deep.eq(stats(1, 0));

		const acquiredSecond = objectPool.acquire(...secondArgs);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));
		expect(DLLObjectPool.value(acquiredSecond)).to.be.deep.eq(constructor(...secondArgs)); // reinitialized
		expect(equals(acquiredFirst, acquiredSecond, Comparison.REFERENCE)).to.be.eq(true); // reused node
		expect(equals(DLLObjectPool.value(acquiredFirst), DLLObjectPool.value(acquiredSecond), Comparison.REFERENCE | Comparison.VALUE)).to.be.eq(true); // reused object

		objectPool.releaseHandle(acquiredSecond);
		expect(objectPool.stats).to.be.deep.eq(stats(1, 0));
	});

	it('reuses memory', () => {
		const MAX_ITER = 1000;

		const objectPool = objectPoolFactory(MAX_ITER);
		const args = shapeArgs();

		// warm up
		const acquired = new Array<DLLObjectPoolHandle<ObjectShape>>(MAX_ITER);
		for (let i = 0; i < MAX_ITER; i++) {
			acquired[i] = objectPool.acquire(...args);
		}

		// play a lil bit
		const reacquired = new Array<DLLObjectPoolHandle<ObjectShape>>(MAX_ITER);
		for (let i = 0; i < MAX_ITER; i++) {
			objectPool.releaseHandle(acquired[i]);
			reacquired[i] = objectPool.acquire(...args);
		}

		// check same nodes were used ...
		let reused = false;
		for (let i = 0; i < MAX_ITER; i++) {
			for (let j = 0; j < MAX_ITER; j++) {
				if ((reused = equals(acquired[i], reacquired[j], Comparison.REFERENCE))) {
					// ...and same objects
					if ((reused = equals(DLLObjectPool.value(acquired[i]), DLLObjectPool.value(reacquired[j]), Comparison.REFERENCE | Comparison.VALUE))) {
						break;
					}
				}
			}

			expect(reused).to.be.eq(true);
			reused = false;
		}
	});

	it('fails to acquire if max capacity reached', () => {
		const capacity = 1;
		const objectPool = objectPoolFactory(capacity);

		objectPool.acquire(...shapeArgs());
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));

		expect(() => objectPool.acquire(...shapeArgs())).to.throw(`Limit of ${capacity} has been reached.`);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));
	});

	it('acquires and releases primitives', () => {
		const ITERATIONS = 2;
		const capacity = 10;

		const objectPool = new DLLObjectPool<string>({
			capacity,
			initialFreeShapes: array.filledWith(capacity, ''),
			constructor: (value: string) => value,
			destructor: () => undefined,
			initializer: (_previous, value: string) => value
		});

		for (let k = 0; k < ITERATIONS; k++) {
			const acquired = new Array<DLLObjectPoolHandle<string>>(capacity);
			for (let i = 0; i < capacity; i++) {
				const value = string.random();
				acquired[i] = objectPool.acquire(value);

				expect(objectPool.stats).to.be.deep.eq(stats(capacity - i - 1, i + 1));
				expect(DLLObjectPool.value(acquired[i])).to.be.deep.eq(value);
			}

			for (let i = 0; i < capacity; i++) {
				objectPool.releaseHandle(acquired[i]);
				expect(objectPool.stats).to.be.deep.eq(stats(i + 1, capacity - i - 1));
			}
		}
	});
});

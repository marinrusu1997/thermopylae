import { number, string, array } from '@thermopylae/lib.utils';
import { chai } from '@thermopylae/lib.unit-test';
import { describe, it } from 'mocha';
import { Library } from '@thermopylae/core.declarations';
import { ObjectPool, ObjectConstructor, ObjectDestructor, ObjectInitializer, ObjectPoolStats, Handle } from '../lib/pools/object-pool';
import { ErrorCodes } from '../lib/exception';

const { expect } = chai;

interface ObjectShape {
	a: number;
	b: string;
}

const constructor: ObjectConstructor<ObjectShape> = (a: number, b: string): ObjectShape => ({ a, b });
const destructor: ObjectDestructor<ObjectShape> = (shape): Promise<boolean> => {
	// @ts-ignore
	shape.a = undefined;
	// @ts-ignore
	shape.b = undefined;
	return new Promise<boolean>((resolve) => setTimeout(resolve, 10, true));
};
const initializer: ObjectInitializer<ObjectShape> = (shape: ObjectShape, a: number, b: string) => {
	shape.a = a;
	shape.b = b;
};

function shapeArgs(): [number, string] {
	return [number.generateRandomNumber(0, 100), string.generateStringOfLength(5)];
}

function initialFreeShapes(quantity: number): Array<ObjectShape> {
	function filler(): ObjectShape {
		return constructor(...shapeArgs());
	}
	return array.filledWith(quantity, filler);
}

function objectPoolFactory(capacity = Infinity, initial?: Array<ObjectShape>): ObjectPool<ObjectShape> {
	return new ObjectPool<ObjectShape>({
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

function stats(free: number, used: number): ObjectPoolStats {
	return { free, used };
}

function clearedShape(): ObjectShape {
	// @ts-ignore
	return { a: undefined, b: undefined };
}

// eslint-disable-next-line mocha/no-setup-in-describe
describe(`${ObjectPool.name} spec`, () => {
	it('constructs pool with initial values, acquires, then releases them all', async () => {
		const shapesNo = 10;
		const initialShapes = initialFreeShapes(shapesNo);

		const objectPool = objectPoolFactory(Infinity, initialShapes);
		expect(objectPool.stats).to.be.deep.eq(stats(shapesNo, 0));

		for (let usedNo = 0; usedNo < shapesNo; usedNo++) {
			const acquired = ObjectPool.value(objectPool.acquire(...shapeArgs()));
			expect(objectPool.stats).to.be.deep.eq(stats(shapesNo - usedNo - 1, usedNo + 1));

			expect(acquired === initialShapes[usedNo]).to.be.eq(true); // pedantic ref check
			expect(acquired).to.be.deep.eq(initialShapes[usedNo]); // initializer did his job
		}

		const releases = objectPool.releaseAll();
		expect(objectPool.stats).to.be.deep.eq(stats(shapesNo, 0));
		expect(await Promise.all(releases)).to.be.equalTo(array.filledWith(shapesNo, true));
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
		const objectPool = objectPoolFactory();
		const args = shapeArgs();

		const actual = objectPool.acquire(...args);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));

		const expected = constructor(...args);
		expect(equals(ObjectPool.value(actual), expected, Comparison.VALUE)).to.be.eq(true);
	});

	it('acquires from free list', () => {
		const initial = initialFreeShapes(1);
		const objectPool = objectPoolFactory(1, initial);
		expect(objectPool.stats).to.be.deep.eq(stats(1, 0));
		const args = shapeArgs();

		const actual = objectPool.acquire(...args);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));

		const expected = constructor(...args);
		expect(equals(ObjectPool.value(actual), expected, Comparison.VALUE)).to.be.eq(true);
		expect(equals(ObjectPool.value(actual), initial[0], Comparison.VALUE | Comparison.REFERENCE)).to.be.eq(true);
	});

	it('acquires by creating new object', () => {
		const initial = initialFreeShapes(1);
		const objectPool = objectPoolFactory(2, initial);
		expect(objectPool.stats).to.be.deep.eq(stats(1, 0));
		const args = shapeArgs();

		const recycled = objectPool.acquire(...args);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));

		const expected = constructor(...args);
		expect(equals(ObjectPool.value(recycled), expected, Comparison.VALUE)).to.be.eq(true);
		expect(equals(ObjectPool.value(recycled), initial[0], Comparison.VALUE | Comparison.REFERENCE)).to.be.eq(true);

		const created = objectPool.acquire(...args);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 2));
		expect(equals(ObjectPool.value(created), expected, Comparison.VALUE)).to.be.eq(true);

		expect(equals(recycled, created, Comparison.REFERENCE)).to.be.eq(false);
		expect(equals(ObjectPool.value(created), ObjectPool.value(recycled), Comparison.REFERENCE)).to.be.eq(false);
	});

	it('releases object', async () => {
		const objectPool = objectPoolFactory();
		const args = shapeArgs();

		const acquired = objectPool.acquire(...args);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));
		const released = objectPool.release(acquired);
		expect(objectPool.stats).to.be.deep.eq(stats(1, 0));

		expect(await released).to.be.eq(true);
		expect(ObjectPool.value(acquired));
	});

	it('releases nothing if there are no objects', () => {
		const objectPool = objectPoolFactory();
		expect(objectPool.releaseAll()).to.be.equalTo([]);
	});

	it('preempts object', async () => {
		const objectPool = objectPoolFactory();
		const object = constructor(...shapeArgs());

		const preempted = objectPool.preempt(object);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));
		expect(equals(ObjectPool.value(preempted), object, Comparison.VALUE | Comparison.REFERENCE)).to.be.eq(true);

		const released = objectPool.release(preempted);
		expect(objectPool.stats).to.be.deep.eq(stats(1, 0));
		expect(await released).to.be.eq(true);
		expect(equals(ObjectPool.value(preempted), clearedShape(), Comparison.VALUE)).to.be.eq(true);
	});

	it('reuses nodes', async () => {
		const objectPool = objectPoolFactory();

		const firstArgs = shapeArgs();
		const secondArgs = shapeArgs();

		const acquiredFirst = objectPool.acquire(...firstArgs);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));
		expect(ObjectPool.value(acquiredFirst)).to.be.deep.eq(constructor(...firstArgs));

		const releasedFirst = objectPool.release(acquiredFirst);
		expect(objectPool.stats).to.be.deep.eq(stats(1, 0));
		expect(await releasedFirst).to.be.eq(true);

		const acquiredSecond = objectPool.acquire(...secondArgs);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));
		expect(equals(acquiredFirst, acquiredSecond, Comparison.REFERENCE)).to.be.eq(true); // reused
		expect(ObjectPool.value(acquiredSecond)).to.be.deep.eq(constructor(...secondArgs));

		const releasedSecond = objectPool.release(acquiredSecond);
		expect(objectPool.stats).to.be.deep.eq(stats(1, 0));
		expect(await releasedSecond).to.be.eq(true);
	});

	it('reuses initial nodes', async () => {
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
		expect(ObjectPool.value(acquiredFirst)).to.be.deep.eq(constructor(...firstArgs));
		expect(reusedObjectFromInitialShapes(ObjectPool.value(acquiredFirst))).to.be.eq(true);

		const releasedFirst = objectPool.release(acquiredFirst);
		expect(objectPool.stats).to.be.deep.eq(stats(initialNo, 0));
		expect(await releasedFirst).to.be.eq(true);

		const acquiredSecond = objectPool.acquire(...secondArgs);
		expect(objectPool.stats).to.be.deep.eq(stats(initialNo - 1, 1));
		expect(ObjectPool.value(acquiredSecond)).to.be.deep.eq(constructor(...secondArgs));
		expect(reusedObjectFromInitialShapes(ObjectPool.value(acquiredSecond))).to.be.eq(true); // reused

		const releasedSecond = objectPool.release(acquiredSecond);
		expect(objectPool.stats).to.be.deep.eq(stats(initialNo, 0));
		expect(await releasedSecond).to.be.eq(true);
	});

	it('reuses objects from nodes', async () => {
		const objectPool = objectPoolFactory();
		expect(objectPool.stats).to.be.deep.eq(stats(0, 0));

		const firstArgs = shapeArgs();
		const secondArgs = shapeArgs();

		const acquiredFirst = objectPool.acquire(...firstArgs);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));
		expect(ObjectPool.value(acquiredFirst)).to.be.deep.eq(constructor(...firstArgs)); // constructed

		const releasedFirst = objectPool.release(acquiredFirst);
		expect(objectPool.stats).to.be.deep.eq(stats(1, 0));
		expect(await releasedFirst).to.be.eq(true);

		const acquiredSecond = objectPool.acquire(...secondArgs);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));
		expect(ObjectPool.value(acquiredSecond)).to.be.deep.eq(constructor(...secondArgs)); // reinitialized
		expect(equals(acquiredFirst, acquiredSecond, Comparison.REFERENCE)).to.be.eq(true); // reused node
		expect(equals(ObjectPool.value(acquiredFirst), ObjectPool.value(acquiredSecond), Comparison.REFERENCE | Comparison.VALUE)).to.be.eq(true); // reused object

		const releasedSecond = objectPool.release(acquiredSecond);
		expect(objectPool.stats).to.be.deep.eq(stats(1, 0));
		expect(await releasedSecond).to.be.eq(true);
	});

	it('reuses memory', () => {
		const MAX_ITER = 1000;

		const objectPool = objectPoolFactory(MAX_ITER);
		const args = shapeArgs();

		// warm up
		const acquired = new Array<Handle<ObjectShape>>(MAX_ITER);
		for (let i = 0; i < MAX_ITER; i++) {
			acquired[i] = objectPool.acquire(...args);
		}

		// play a lil bit
		const reacquired = new Array<Handle<ObjectShape>>(MAX_ITER);
		for (let i = 0; i < MAX_ITER; i++) {
			objectPool.release(acquired[i]);
			reacquired[i] = objectPool.acquire(...args);
		}

		// check same nodes were used ...
		let reused = false;
		for (let i = 0; i < MAX_ITER; i++) {
			for (let j = 0; j < MAX_ITER; j++) {
				if ((reused = equals(acquired[i], reacquired[j], Comparison.REFERENCE))) {
					// ...and same objects
					if ((reused = equals(ObjectPool.value(acquired[i]), ObjectPool.value(reacquired[j]), Comparison.REFERENCE | Comparison.VALUE))) {
						break;
					}
				}
			}

			expect(reused).to.be.eq(true);
			reused = false;
		}
	});

	it('fails to acquire is max capacity reached', () => {
		const capacity = 1;
		const objectPool = objectPoolFactory(capacity);

		objectPool.acquire(...shapeArgs());
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));

		expect(() => objectPool.acquire(...shapeArgs())).to.throw(`Limit of ${capacity} has been reached.`);
		expect(objectPool.stats).to.be.deep.eq(stats(0, 1));
	});
});

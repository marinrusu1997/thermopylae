import { describe, it } from 'mocha';
import { expect } from '@thermopylae/dev.unit-test';
import { Exception } from '@thermopylae/lib.exception';
import { ArrayObjectPool, ObjectResource } from '../lib';

describe(`${ArrayObjectPool.name} spec`, () => {
	it('acquires & releases objects from pool with capacity 1', () => {
		const pool = new ArrayObjectPool({
			capacity: 1,
			initializer(resource, args) {
				[resource['key']] = args;
			},
			deInitializer(resource) {
				resource['key'] = undefined;
			}
		});
		expect(pool.free).to.be.eq(1);
		expect(pool.used).to.be.eq(0);

		const resource = pool.acquire('value');
		expect(pool.free).to.be.eq(0);
		expect(pool.used).to.be.eq(1);
		expect(resource.value['key']).to.be.eq('value');

		expect(() => pool.acquire()).to.throw(Exception);

		pool.release(resource);
		expect(pool.free).to.be.eq(1);
		expect(pool.used).to.be.eq(0);
		expect(resource.value['key']).to.be.eq(undefined);

		const secondAcquire = pool.acquire('second-value');
		expect(secondAcquire).to.be.eq(resource); // reused object
		expect(pool.free).to.be.eq(0);
		expect(pool.used).to.be.eq(1);
		expect(resource.value['key']).to.be.eq('second-value');

		pool.releaseAll();
		expect(pool.free).to.be.eq(1);
		expect(pool.used).to.be.eq(0);
		expect(resource.value['key']).to.be.eq(undefined);
	});

	it('acquires & releases objects from pool', () => {
		const pool = new ArrayObjectPool({
			capacity: 10,
			initializer(resource, args) {
				[resource['key']] = args;
			},
			deInitializer(resource) {
				resource['key'] = undefined;
			}
		});

		const firstRes = pool.acquire('1');
		expect(firstRes.value['key']).to.be.eq('1');

		const secondRes = pool.acquire('2');
		expect(secondRes.value['key']).to.be.eq('2');

		const thirdRes = pool.acquire('3');
		expect(thirdRes.value['key']).to.be.eq('3');

		const fourthRes = pool.acquire('4');
		expect(fourthRes.value['key']).to.be.eq('4');

		const fifthRes = pool.acquire('5');
		expect(fifthRes.value['key']).to.be.eq('5');

		expect(pool.free).to.be.eq(5);
		expect(pool.used).to.be.eq(5);

		// do not reorder them
		pool.release(firstRes);
		expect(firstRes.value['key']).to.be.eq(undefined);

		pool.release(fourthRes);
		expect(fourthRes.value['key']).to.be.eq(undefined);

		pool.release(secondRes);
		expect(secondRes.value['key']).to.be.eq(undefined);

		pool.release(fifthRes);
		expect(fifthRes.value['key']).to.be.eq(undefined);

		pool.release(thirdRes);
		expect(thirdRes.value['key']).to.be.eq(undefined);

		expect(pool.free).to.be.eq(10);
		expect(pool.used).to.be.eq(0);

		const resources = new Array<ObjectResource<Record<string, any>>>(10);
		for (let i = 0; i < 10; i++) {
			resources[i] = pool.acquire(i);
			expect(resources[i].value['key']).to.be.eq(i);
		}
		expect(pool.free).to.be.eq(0);

		for (let i = 9; i >= 0; i--) {
			pool.release(resources[i]);
			expect(resources[i].value['key']).to.be.eq(undefined);
			expect(pool.used).to.be.eq(i);
		}
		expect(pool.free).to.be.eq(10);

		for (let i = 0; i < 10; i++) {
			resources[i] = pool.acquire(i);
			expect(resources[i].value['key']).to.be.eq(i);
		}
		expect(pool.free).to.be.eq(0);

		for (let i = 0; i < 10; i++) {
			pool.release(resources[i]);
			expect(resources[i].value['key']).to.be.eq(undefined);
			expect(pool.free).to.be.eq(i + 1);
		}

		for (let i = 0; i < 10; i++) {
			resources[i] = pool.acquire(i);
			expect(resources[i].value['key']).to.be.eq(i);
		}
		expect(pool.free).to.be.eq(0);

		for (let i = 5; i < 10; i++) {
			pool.release(resources[i]);
			expect(resources[i].value['key']).to.be.eq(undefined);
		}
		expect(pool.used).to.be.eq(5);
		expect(pool.free).to.be.eq(5);

		pool.releaseAll();
		expect(pool.used).to.be.eq(0);
		expect(pool.free).to.be.eq(10);
		for (let i = 0; i < 10; i++) {
			expect(resources[i].value['key']).to.be.eq(undefined);
		}

		pool.clear();
		expect(pool.used).to.be.eq(-1);
	});

	it('can grow dynamically the pool of resources', () => {
		const pool = new ArrayObjectPool({
			initializer(resource, args) {
				[resource['key']] = args;
			},
			deInitializer(resource) {
				resource['key'] = undefined;
			}
		});

		const first = pool.acquire('1');
		expect(first.value['key']).to.be.eq('1');
		expect(pool.used).to.be.eq(1);
		expect(pool.free).to.be.eq(0);

		const second = pool.acquire('2');
		expect(second.value['key']).to.be.eq('2');
		expect(pool.used).to.be.eq(2);
		expect(pool.free).to.be.eq(0);

		const third = pool.acquire('3');
		expect(third.value['key']).to.be.eq('3');
		expect(pool.used).to.be.eq(3);
		expect(pool.free).to.be.eq(0);

		pool.release(first);
		expect(first.value['key']).to.be.eq(undefined);
		expect(second.value['key']).to.be.eq('2');
		expect(third.value['key']).to.be.eq('3');
		expect(pool.free).to.be.eq(1);
		expect(pool.used).to.be.eq(2);

		pool.release(second);
		expect(first.value['key']).to.be.eq(undefined);
		expect(second.value['key']).to.be.eq(undefined);
		expect(third.value['key']).to.be.eq('3');
		expect(pool.free).to.be.eq(2);
		expect(pool.used).to.be.eq(1);

		pool.release(third);
		expect(first.value['key']).to.be.eq(undefined);
		expect(second.value['key']).to.be.eq(undefined);
		expect(third.value['key']).to.be.eq(undefined);
		expect(pool.free).to.be.eq(3);
		expect(pool.used).to.be.eq(0);
	});
});

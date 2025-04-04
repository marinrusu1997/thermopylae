import type { Milliseconds } from '@thermopylae/core.declarations';
import { array, chrono } from '@thermopylae/lib.utils';
import { describe, expect, it } from 'vitest';
import { runInSeries, synchronize, toPromise } from '../../lib/index.js';

describe('concurrency utils spec', () => {
	describe(`${runInSeries.name} spec`, () => {
		it('runs async functions in series (no start value)', async () => {
			const fun1 = async () => 1;
			const fun2 = async (prevVal: number) => {
				expect(prevVal).to.be.eq(1);
				return 2;
			};
			const fun3 = async (prevVal: number) => {
				expect(prevVal).to.be.eq(2);
				return 3;
			};
			expect(await runInSeries([fun1, fun2, fun3])).toStrictEqual([1, 2, 3]);
		});

		it('runs async functions in series (with start value)', async () => {
			const fun1 = async (prevVal: number) => {
				expect(prevVal).to.be.eq(0);
				return 1;
			};
			const fun2 = async (prevVal: number) => {
				expect(prevVal).to.be.eq(1);
				return 2;
			};
			const fun3 = async (prevVal: number) => {
				expect(prevVal).to.be.eq(2);
				return 3;
			};
			expect(await runInSeries([fun1, fun2, fun3], 0)).toStrictEqual([1, 2, 3]);
		});
	});

	describe(`${toPromise.name} spec`, () => {
		it('returns same promise if passing a promise', async () => {
			expect(await toPromise(Promise.resolve(1))).to.be.eq(1);
		});

		it('creates new promise if passing a value', async () => {
			expect(await toPromise(1)).to.be.eq(1);
		});
	});

	describe(`${synchronize.name} spec`, () => {
		it('returned function returns same result as provided one', async () => {
			async function fn(): Promise<number> {
				return 1;
			}
			const highOrderFn = synchronize(fn);
			expect(await fn()).to.be.deep.eq(await highOrderFn());
		});

		it('synchronized function will call original func only once', async () => {
			const longOpResult = `Secret of the Universe is: ¯\\_(ツ)_/¯`;
			const longOpDuration: Milliseconds = 500;
			const epsilon = 20;

			let longOpCalls = 0;

			async function longOperation(): Promise<string> {
				longOpCalls += 1;
				await chrono.sleep(longOpDuration);
				return longOpResult;
			}
			const synchronizedFn = synchronize(longOperation);
			const synchronizedCalls = 10;

			const calls = array.filledWith(synchronizedCalls, synchronizedFn());

			const startTime = Date.now();
			const results = await Promise.all(calls);
			const endTime = Date.now();

			expect(longOpCalls).to.be.eq(1);
			const duration = endTime - startTime;
			expect(duration).toBeGreaterThanOrEqual(longOpDuration - epsilon);
			expect(duration).toBeLessThanOrEqual(longOpDuration + epsilon);

			expect(results.length).to.be.eq(synchronizedCalls);
			expect(results).toStrictEqual(array.filledWith(synchronizedCalls, longOpResult));
		});

		it('synchronized function can be called multiple times after it has been resolved', async () => {
			const longOpRes = 1;
			let longOpCalls = 0;

			async function longOp(): Promise<number> {
				longOpCalls += 1;
				await chrono.sleep(100);
				return longOpRes;
			}
			const synchronizedFn = synchronize(longOp);
			const synchronizedCalls = 3;

			const multipleRes = await Promise.all(array.filledWith(synchronizedCalls, synchronizedFn()));
			expect(longOpCalls).to.be.eq(1);
			expect(multipleRes).toStrictEqual(array.filledWith(synchronizedCalls, longOpRes));

			const singleRes = await synchronizedFn();
			expect(longOpCalls).to.be.eq(2);
			expect(singleRes).to.be.eq(longOpRes);

			const res = await Promise.all(array.filledWith(synchronizedCalls, synchronizedFn()));
			expect(longOpCalls).to.be.eq(3);
			expect(res).toStrictEqual(array.filledWith(synchronizedCalls, longOpRes));
		});
	});
});

import type { Milliseconds } from '@thermopylae/core.declarations';
import { setTimeout as sleep } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { runInSeries, synchronize, toPromise } from '../../lib/index.js';

describe('concurrency utils spec', () => {
	describe(`${runInSeries.name} spec`, () => {
		it('runs async functions in series (no start value)', async () => {
			await expect(
				runInSeries([
					() => Promise.resolve(1),
					(prevVal: number) => {
						expect(prevVal).to.be.eq(1);
						return Promise.resolve(2);
					},
					(prevVal: number) => {
						expect(prevVal).to.be.eq(2);
						return Promise.resolve(3);
					}
				])
			).resolves.toStrictEqual([1, 2, 3]);
		});

		it('runs async functions in series (with start value)', async () => {
			await expect(
				runInSeries(
					[
						(prevVal: number) => {
							expect(prevVal).to.be.eq(0);
							return Promise.resolve(1);
						},
						(prevVal: number) => {
							expect(prevVal).to.be.eq(1);
							return Promise.resolve(2);
						},
						(prevVal: number) => {
							expect(prevVal).to.be.eq(2);
							return Promise.resolve(3);
						}
					],
					0
				)
			).resolves.toStrictEqual([1, 2, 3]);
		});
	});

	describe(`${toPromise.name} spec`, () => {
		it('returns same promise if passing a promise', async () => {
			await expect(toPromise(Promise.resolve(1))).resolves.to.be.eq(1);
		});

		it('creates new promise if passing a value', async () => {
			await expect(toPromise(1)).resolves.to.be.eq(1);
		});
	});

	describe(`${synchronize.name} spec`, () => {
		it('returned function returns same result as provided one', async () => {
			// oxlint-disable-next-line consistent-function-scoping
			function fn(): Promise<number> {
				return Promise.resolve(1);
			}
			const highOrderFn = synchronize(fn);
			await expect(fn()).resolves.to.be.deep.eq(await highOrderFn());
		});

		it('synchronized function will call original func only once', async () => {
			const longOpResult = `Secret of the Universe is: ¯\\_(ツ)_/¯`;
			const longOpDuration: Milliseconds = 500;
			const epsilon = 20;

			let longOpCalls = 0;

			async function longOperation(): Promise<string> {
				longOpCalls += 1;
				await sleep(longOpDuration);
				return longOpResult;
			}
			const synchronizedFn = synchronize(longOperation);
			const synchronizedCalls = 10;

			const calls = Array.from({ length: synchronizedCalls }).fill(synchronizedFn());

			const startTime = Date.now();
			const results = await Promise.all(calls);
			const endTime = Date.now();

			expect(longOpCalls).to.be.eq(1);
			const duration = endTime - startTime;
			expect(duration).toBeGreaterThanOrEqual(longOpDuration - epsilon);
			expect(duration).toBeLessThanOrEqual(longOpDuration + epsilon);

			expect(results.length).to.be.eq(synchronizedCalls);
			expect(results).toStrictEqual(Array.from({ length: synchronizedCalls }).fill(longOpResult));
		});

		it('synchronized function can be called multiple times after it has been resolved', async () => {
			const longOpRes = 1;
			let longOpCalls = 0;

			async function longOp(): Promise<number> {
				longOpCalls += 1;
				await sleep(100);
				return longOpRes;
			}
			const synchronizedFn = synchronize(longOp);
			const synchronizedCalls = 3;

			const multipleRes = await Promise.all(Array.from({ length: synchronizedCalls }).fill(synchronizedFn()));
			expect(longOpCalls).to.be.eq(1);
			expect(multipleRes).toStrictEqual(Array.from({ length: synchronizedCalls }).fill(longOpRes));

			const singleRes = await synchronizedFn();
			expect(longOpCalls).to.be.eq(2);
			expect(singleRes).to.be.eq(longOpRes);

			const res = await Promise.all(Array.from({ length: synchronizedCalls }).fill(synchronizedFn()));
			expect(longOpCalls).to.be.eq(3);
			expect(res).toStrictEqual(Array.from({ length: synchronizedCalls }).fill(longOpRes));
		});
	});
});

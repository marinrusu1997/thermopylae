import { describe, it } from 'mocha';
import { Milliseconds } from '@thermopylae/core.declarations';
import { chai } from './chai';
import { ErrorCodes, LabeledConditionalVariable, PromiseExecutor, runInSeries, synchronize, toPromise } from '../lib/async';
import { sleep } from '../lib/chrono';
import { array, number } from '../lib';

const { expect } = chai;

describe('async spec', () => {
	// eslint-disable-next-line mocha/no-setup-in-describe
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
			expect(await runInSeries([fun1, fun2, fun3])).to.be.equalTo([1, 2, 3]);
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
			expect(await runInSeries([fun1, fun2, fun3], 0)).to.be.equalTo([1, 2, 3]);
		});
	});

	// eslint-disable-next-line mocha/no-setup-in-describe
	describe(`${toPromise.name} spec`, () => {
		it('returns same promise if passing a promise', async () => {
			expect(await toPromise(Promise.resolve(1))).to.be.eq(1);
		});

		it('creates new promise if passing a value', async () => {
			expect(await toPromise(1)).to.be.eq(1);
		});
	});

	// eslint-disable-next-line mocha/no-setup-in-describe
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
				await sleep(longOpDuration);
				return longOpResult;
			}
			const synchronizedFn = synchronize(longOperation);
			const synchronizedCalls = 10;

			const calls = array.filledWith(synchronizedCalls, synchronizedFn());

			const startTime = Date.now();
			const results = await Promise.all(calls);
			const endTime = Date.now();

			expect(longOpCalls).to.be.eq(1);
			// @ts-ignore
			expect(endTime - startTime).to.be.in.range(longOpDuration - epsilon, longOpDuration + epsilon);
			expect(results.length).to.be.eq(synchronizedCalls);
			expect(results).to.be.equalTo(array.filledWith(synchronizedCalls, longOpResult));
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

			const multipleRes = await Promise.all(array.filledWith(synchronizedCalls, synchronizedFn()));
			expect(longOpCalls).to.be.eq(1);
			expect(multipleRes).to.be.equalTo(array.filledWith(synchronizedCalls, longOpRes));

			const singleRes = await synchronizedFn();
			expect(longOpCalls).to.be.eq(2);
			expect(singleRes).to.be.eq(longOpRes);

			const res = await Promise.all(array.filledWith(synchronizedCalls, synchronizedFn()));
			expect(longOpCalls).to.be.eq(3);
			expect(res).to.be.equalTo(array.filledWith(synchronizedCalls, longOpRes));
		});
	});

	// eslint-disable-next-line mocha/no-setup-in-describe
	describe(`${LabeledConditionalVariable.name} spec`, () => {
		it('acquires mutex for a given label', () => {
			const mutex = new LabeledConditionalVariable();
			expect(mutex.wait('label')[0]).to.be.eq(true);
		});

		it("doesn't wait mutex if it was acquired already", () => {
			const mutex = new LabeledConditionalVariable();

			let [acquired, lock] = mutex.wait('label');
			expect(acquired).to.be.eq(true);
			expect(lock).to.be.an.instanceOf(Promise);

			[acquired, lock] = mutex.wait('label');
			expect(acquired).to.be.eq(false);
			expect(lock).to.be.an.instanceOf(Promise);
		});

		it("timeouts lock if it wasn't released in the given interval", async () => {
			const mutex = new LabeledConditionalVariable();
			const timeout = 10;
			const label = 'key';

			const acquireStart = Date.now();
			const [acquired, lock] = mutex.wait(label, timeout);

			expect(acquired).to.be.eq(true);
			await expect(lock).to.be.rejectedWith(`Timeout of ${timeout} ms for label ${label} has been exceeded.`);
			// @ts-ignore
			expect(Date.now() - acquireStart).to.be.in.range(timeout, timeout + 20);
		});

		it("won't timeout the lock if it's value is 0", async () => {
			const mutex = new LabeledConditionalVariable();
			const timeout = 0;
			const label = 'key';

			const [acquired, lock] = mutex.wait(label, timeout);
			expect(acquired).to.be.eq(true);

			await sleep(20);

			mutex.notifyAll(label, '');
			expect(await lock).to.be.eq('');
		});

		it('acquires lock again if it was timeout-ed', async () => {
			const mutex = new LabeledConditionalVariable();
			const label = 'key';
			let timeout = 10;

			let [acquired, lock] = mutex.wait(label, timeout);
			expect(acquired).to.be.eq(true);
			expect(mutex.wait(label, timeout)[0]).to.be.eq(false);
			await expect(lock).to.be.rejectedWith(`Timeout of ${timeout} ms for label ${label} has been exceeded.`);

			timeout = 20;
			[acquired, lock] = mutex.wait(label, timeout);
			expect(acquired).to.be.eq(true);
			await expect(lock).to.be.rejectedWith(`Timeout of ${timeout} ms for label ${label} has been exceeded.`);
		});

		it("multiple consumers can wait same mutex and won't deadlock", async () => {
			const mutex = new LabeledConditionalVariable<string, number>();
			const label = 'key';
			const consumersNo = 10;

			const promises: Array<Promise<number>> = new Array<Promise<number>>(consumersNo);
			for (let i = 0; i < consumersNo; i++) {
				[, promises[i]] = mutex.wait(label);
			}

			for (let i = 1; i < consumersNo; i++) {
				expect(promises[i]).to.be.eq(promises[0]);
			}

			mutex.forcedNotifyAll();

			await expect(Promise.all(promises)).to.be.rejectedWith(`Label ${label} has been released forcibly.`);
		});

		it('releases acquired lock with result', async () => {
			const mutex = new LabeledConditionalVariable();
			const label = 'key';
			const result = 1;

			const [acquired, lock] = mutex.wait(label);
			expect(acquired).to.be.eq(true);
			mutex.notifyAll(label, result);

			expect(await lock).to.be.eq(result);
		});

		it('releases acquired lock with error', async () => {
			const mutex = new LabeledConditionalVariable();
			const label = 'key';
			const error = new Error('Operation failed');

			const [acquired, lock] = mutex.wait(label);
			expect(acquired).to.be.eq(true);
			mutex.notifyAll(label, error);

			await expect(lock).to.be.rejectedWith(error);
		});

		it('releases acquired lock to multiple consumers', async () => {
			const mutex = new LabeledConditionalVariable();

			const label = 'key';
			const result = 0;
			const consumersNo = 10;

			const promises: Array<Promise<number>> = new Array<Promise<number>>(consumersNo);
			for (let i = 0; i < consumersNo; i++) {
				[, promises[i]] = mutex.wait(label);
			}

			mutex.notifyAll(label, result);

			expect(await Promise.all(promises)).to.be.equalTo(array.filledWith(consumersNo, result));
		});

		it('clears timeout on explicit notifyAll', async () => {
			const mutex = new LabeledConditionalVariable();

			const label = '';
			const timeout = 10;
			const result = null;

			const [acquired, lock] = mutex.wait(label, timeout);
			expect(acquired).to.be.eq(true);

			mutex.notifyAll(label, result);
			expect(await lock).to.be.eq(result);

			await sleep(10);
			expect(await lock).to.be.eq(result);
		});

		it("fails to notifyAll lock which wasn't acquired", () => {
			const mutex = new LabeledConditionalVariable();
			expect(() => mutex.notifyAll('key')).to.throw(`No lock found for label key.`);
		});

		it('fails to notifyAll same lock multiple times', async () => {
			const mutex = new LabeledConditionalVariable();
			const label = 'key';

			const [acquired, lock] = mutex.wait(label);
			expect(acquired).to.be.eq(true);

			mutex.notifyAll(label);
			expect(await lock).to.be.eq(undefined);

			expect(() => mutex.notifyAll(label)).to.throw(`No lock found for label ${label}.`);
		});

		it('fails to notifyAll lock after timeout', async () => {
			const mutex = new LabeledConditionalVariable();
			const label = 'key';
			const timeout = 10;

			const [acquired, lock] = mutex.wait(label, timeout);
			expect(acquired).to.be.eq(true);

			await expect(lock).to.be.rejectedWith(`Timeout of ${timeout} ms for label ${label} has been exceeded.`);
			expect(() => mutex.notifyAll(label)).to.throw(`No lock found for label ${label}.`);
		});

		it('fails to wait lock when timeout is too high', () => {
			const mutex = new LabeledConditionalVariable();
			const label = 'key';

			expect(() => mutex.wait(label, -1)).to.throw(`Timeout ranges between 0 and ${LabeledConditionalVariable.MAX_TIMEOUT}.`);
			expect(() => mutex.wait(label, LabeledConditionalVariable.MAX_TIMEOUT + 1)).to.throw(
				`Timeout ranges between 0 and ${LabeledConditionalVariable.MAX_TIMEOUT}.`
			);
		});

		it('releases forcibly a set of labels', async () => {
			const mutex = new LabeledConditionalVariable();
			const labels = [1, 2, 3, 4, 5, 6].map((n) => n.toString());

			const promises: Array<Promise<any>> = new Array(labels.length);
			for (let i = 0; i < labels.length; i++) {
				[, promises[i]] = mutex.wait(labels[i]);
			}

			const toForceRelease = new Set();
			for (let i = 0; i < labels.length / 2; i++) {
				toForceRelease.add(labels[number.generateRandomInt(0, labels.length - 1)]);
			}

			mutex.forcedNotifyAll((label) => toForceRelease.has(label));

			let err;
			try {
				await Promise.all(promises);
			} catch (e) {
				err = e;
			}
			expect(err.code).to.be.eq(ErrorCodes.FORCED_RELEASE);
			expect(err.message).to.be.oneOf(Array.from(toForceRelease).map((label) => `Label ${label} has been released forcibly.`));

			for (let i = 0; i < labels.length; i++) {
				if (!toForceRelease.has(labels[i])) {
					mutex.notifyAll(labels[i], Infinity);
					expect(await promises[i]).to.be.eq(Infinity);
				}
			}

			expect(mutex.size).to.be.eq(0);
		});
	});

	// eslint-disable-next-line mocha/no-setup-in-describe
	describe(`${PromiseExecutor.name} spec`, () => {
		it('processes data in sequential order', async () => {
			const items = 10;
			const duration = 100;
			async function longRunningProcessor(): Promise<null> {
				await sleep(duration);
				return null;
			}

			const start = Date.now();
			await PromiseExecutor.run<null, null>(longRunningProcessor, array.filledWith(items, null), PromiseExecutor.SEQUENTIAL);
			const end = Date.now();

			const expectedDuration = items * duration;
			// @ts-ignore
			expect(end - start).to.be.in.range(expectedDuration - duration, expectedDuration + duration);
		});

		it('processes data in parallel order', async () => {
			const items = 10;
			const duration = 100;
			const epsilon = 20;
			async function longRunningProcessor(): Promise<null> {
				await sleep(duration);
				return null;
			}

			const start = Date.now();
			await PromiseExecutor.run<null, null>(longRunningProcessor, array.filledWith(items, null), PromiseExecutor.PARALLEL);
			const end = Date.now();

			const expectedDuration = duration;
			// @ts-ignore
			expect(end - start).to.be.in.range(expectedDuration - epsilon, expectedDuration + epsilon);
		});

		it('processes data in batches', async () => {
			const items = 10;
			const duration = 100;
			const epsilon = 50;
			const concurrency = 2;
			async function longRunningProcessor(): Promise<null> {
				await sleep(duration);
				return null;
			}

			const start = Date.now();
			await PromiseExecutor.run<null, null>(longRunningProcessor, array.filledWith(items, null), concurrency);
			const end = Date.now();

			const expectedDuration = (items * duration) / concurrency;
			// @ts-ignore
			expect(end - start).to.be.in.range(expectedDuration - epsilon, expectedDuration + epsilon);
		});

		it('creates a runnable command', async () => {
			const items = 10;
			const duration = 100;
			async function longRunningProcessor(): Promise<null> {
				await sleep(duration);
				return null;
			}

			const command = PromiseExecutor.command<null, null>(longRunningProcessor, array.filledWith(items, null), PromiseExecutor.SEQUENTIAL);

			const start = Date.now();
			await command.execute();
			const end = Date.now();

			const expectedDuration = items * duration;
			// @ts-ignore
			expect(end - start).to.be.in.range(expectedDuration - duration, expectedDuration + duration);
		});

		it('fails to create command if concurrency is negative', () => {
			expect(() => PromiseExecutor.command(() => Promise.resolve(), [], -1)).to.throw(
				`Concurrency needs to have a min value of 2. Provided concurrency: -1. `
			);
		});

		it('fails to create command if concurrency is equal to 1 (must use SERIAL instead)', () => {
			expect(() => PromiseExecutor.command(() => Promise.resolve(), [], 1)).to.throw(
				`Concurrency needs to have a min value of 2. Provided concurrency: 1. ` +
					`For sequential concurrency please provide ${PromiseExecutor.SEQUENTIAL} value.`
			);
		});

		it('fails to run with concurrency equal to 1 (must use SERIAL instead)', async () => {
			async function processor(): Promise<null> {
				return null;
			}

			await expect(PromiseExecutor.run(processor, [], 1)).to.be.rejectedWith(
				`Concurrency needs to have a min value of 2. Provided concurrency: 1. ` +
					`For sequential concurrency please provide ${PromiseExecutor.SEQUENTIAL} value.`
			);
		});

		it('fails to run with negative concurrency', async () => {
			async function processor(): Promise<null> {
				return null;
			}

			await expect(PromiseExecutor.run(processor, [], -1)).to.be.rejectedWith(`Concurrency needs to have a min value of 2. Provided concurrency: -1. `);
		});
	});
});

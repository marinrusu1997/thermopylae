/* eslint no-bitwise: 0 */ // --> OFF

import { describe, it } from 'mocha';
import { chai } from '@thermopylae/lib.unit-test';
import { array, chrono, number } from '@thermopylae/lib.utils';
import { Library, Optional } from '@thermopylae/core.declarations';
import { AwaiterRole, LabeledConditionalVariable, LockedOperation } from '../../lib/concurrency';
import { ErrorCodes } from '../../lib';

const { expect } = chai;

// eslint-disable-next-line mocha/no-setup-in-describe
describe(`${LabeledConditionalVariable.name} spec`, () => {
	describe('wait spec', () => {
		it('acquires mutex for a given label', () => {
			const mutex = new LabeledConditionalVariable();
			expect(mutex.wait('label').role).to.be.eq(AwaiterRole.PRODUCER);
		});

		it("doesn't wait mutex if it was acquired already", () => {
			const mutex = new LabeledConditionalVariable();

			let waitStatus = mutex.wait('label');
			expect(waitStatus.role).to.be.eq(AwaiterRole.PRODUCER);
			expect(waitStatus.promise).to.be.an.instanceOf(Promise);

			waitStatus = mutex.wait('label');
			expect(waitStatus.role).to.be.eq(AwaiterRole.CONSUMER);
			expect(waitStatus.promise).to.be.an.instanceOf(Promise);
		});

		it("timeouts lock if it wasn't released in the given interval", async () => {
			const mutex = new LabeledConditionalVariable();
			const timeout = 10;
			const label = 'key';

			const acquireStart = Date.now();
			const { role, promise } = mutex.wait(label, LockedOperation.NOOP, timeout);

			expect(role).to.be.eq(AwaiterRole.PRODUCER);
			await expect(promise).to.be.rejectedWith(`Timeout of ${timeout} ms for label ${label} has been exceeded.`);
			// @ts-ignore
			expect(Date.now() - acquireStart).to.be.in.range(timeout, timeout + 20);
		});

		it("won't timeout the lock if it's value is 0", async () => {
			const mutex = new LabeledConditionalVariable();
			const timeout = 0;
			const label = 'key';

			const { role, promise } = mutex.wait(label, timeout);
			expect(role).to.be.eq(AwaiterRole.PRODUCER);

			await chrono.sleep(20);

			mutex.notifyAll(label, '');
			expect(await promise).to.be.eq('');
		});

		it('acquires lock again if it was timeout-ed', async () => {
			const mutex = new LabeledConditionalVariable();
			const label = 'key';
			let timeout = 10;

			const { promise, role } = mutex.wait(label, LockedOperation.NOOP, timeout);
			expect(role).to.be.eq(AwaiterRole.PRODUCER);
			expect(mutex.wait(label, LockedOperation.NOOP, timeout).role).to.be.eq(AwaiterRole.CONSUMER);
			await expect(promise).to.be.rejectedWith(`Timeout of ${timeout} ms for label ${label} has been exceeded.`);

			timeout = 20;
			const waitStatus = mutex.wait(label, LockedOperation.NOOP, timeout);
			expect(waitStatus.role).to.be.eq(AwaiterRole.PRODUCER);
			await expect(waitStatus.promise).to.be.rejectedWith(`Timeout of ${timeout} ms for label ${label} has been exceeded.`);
		});

		it("multiple consumers can wait same mutex and won't deadlock", async () => {
			const mutex = new LabeledConditionalVariable<string, number>();
			const label = 'key';
			const consumersNo = 10;

			const promises = new Array<Promise<Optional<number>>>(consumersNo);
			for (let i = 0; i < consumersNo; i++) {
				promises[i] = mutex.wait(label).promise;
			}

			for (let i = 1; i < consumersNo; i++) {
				expect(promises[i]).to.be.eq(promises[0]);
			}

			mutex.forcedNotify();

			await expect(Promise.all(promises)).to.be.rejectedWith(`Label ${label} has been released forcibly.`);
		});

		it('fails to wait lock when timeout is too high', () => {
			const mutex = new LabeledConditionalVariable();
			const label = 'key';

			const tooLowTimeout = -1;
			const tooHighTimeout = LabeledConditionalVariable.MAX_TIMEOUT + 1;

			expect(() => mutex.wait(label, LockedOperation.NOOP, tooLowTimeout)).to.throw(
				`Timeout ranges between 0 and ${LabeledConditionalVariable.MAX_TIMEOUT} ms. Given: ${tooLowTimeout}`
			);
			expect(() => mutex.wait(label, LockedOperation.NOOP, tooHighTimeout)).to.throw(
				`Timeout ranges between 0 and ${LabeledConditionalVariable.MAX_TIMEOUT} ms. Given: ${tooHighTimeout}`
			);
		});

		it('fails to lock on unknown operation', () => {
			const mutex = new LabeledConditionalVariable();
			const label = 'key';
			expect(() => mutex.wait(label, -1)).to.throw(`Requested an unknown operation ${-1}.`);
		});

		describe('operations overlap spec', () => {
			it('noop -> noop (success)', async () => {
				const condVar = new LabeledConditionalVariable();
				const label = 'label';

				const waitStatusProd = condVar.wait(label, LockedOperation.NOOP);
				expect(waitStatusProd.role).to.be.eq(AwaiterRole.PRODUCER);

				const waitStatusCons = condVar.wait(label, LockedOperation.NOOP);
				expect(waitStatusCons.role).to.be.eq(AwaiterRole.CONSUMER);

				condVar.notifyAll(label, null);
				expect(await waitStatusProd.promise).to.be.eq(null);
			});

			it('noop -> read | write | read & write (failure)', async () => {
				const condVar = new LabeledConditionalVariable();
				const label = 'label';

				const waitStatusProd = condVar.wait(label, LockedOperation.NOOP);
				expect(waitStatusProd.role).to.be.eq(AwaiterRole.PRODUCER);

				expect(() => condVar.wait(label, LockedOperation.READ)).to.throw(
					`Lock acquired for label ${label} on ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.NOOP)} operation, ` +
						`but requested operation is ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.READ)}.`
				);

				expect(() => condVar.wait(label, LockedOperation.WRITE)).to.throw(
					`Lock acquired for label ${label} on ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.NOOP)} operation, ` +
						`but requested operation is ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.WRITE)}.`
				);

				expect(() => condVar.wait(label, LockedOperation.WRITE | LockedOperation.READ)).to.throw(
					`Lock acquired for label ${label} on ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.NOOP)} operation, ` +
						`but requested operation is ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.WRITE | LockedOperation.READ)}.`
				);

				condVar.notifyAll(label, null);
				expect(await waitStatusProd.promise).to.be.eq(null);
			});

			it('write -> any (failure)', async () => {
				const condVar = new LabeledConditionalVariable();
				const label = 'label';

				const waitStatusProd = condVar.wait(label, LockedOperation.WRITE);
				expect(waitStatusProd.role).to.be.eq(AwaiterRole.PRODUCER);

				expect(() => condVar.wait(label, LockedOperation.NOOP)).to.throw(
					`Lock acquired for label ${label} on ${LabeledConditionalVariable.formatLockedOperation(
						LockedOperation.WRITE
					)} operation, which is an exclusive one. Given: ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.NOOP)}.`
				);

				expect(() => condVar.wait(label, LockedOperation.READ)).to.throw(
					`Lock acquired for label ${label} on ${LabeledConditionalVariable.formatLockedOperation(
						LockedOperation.WRITE
					)} operation, which is an exclusive one. Given: ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.READ)}.`
				);

				expect(() => condVar.wait(label, LockedOperation.WRITE)).to.throw(
					`Lock acquired for label ${label} on ${LabeledConditionalVariable.formatLockedOperation(
						LockedOperation.WRITE
					)} operation, which is an exclusive one. Given: ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.WRITE)}.`
				);

				expect(() => condVar.wait(label, LockedOperation.WRITE | LockedOperation.READ)).to.throw(
					`Lock acquired for label ${label} on ${LabeledConditionalVariable.formatLockedOperation(
						LockedOperation.WRITE
					)} operation, which is an exclusive one. ` +
						`Given: ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.WRITE | LockedOperation.READ)}.`
				);

				expect(() => condVar.wait(label, LockedOperation.NOOP | LockedOperation.WRITE | LockedOperation.READ)).to.throw(
					`Lock acquired for label ${label} on ${LabeledConditionalVariable.formatLockedOperation(
						LockedOperation.WRITE
					)} operation, which is an exclusive one. ` +
						`Given: ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.NOOP | LockedOperation.WRITE | LockedOperation.READ)}.`
				);

				condVar.notifyAll(label, null);
				expect(await waitStatusProd.promise).to.be.eq(null);
			});

			it('read -> noop | write | read & write (failure)', async () => {
				const condVar = new LabeledConditionalVariable();
				const label = 'label';

				const waitStatusProd = condVar.wait(label, LockedOperation.READ);
				expect(waitStatusProd.role).to.be.eq(AwaiterRole.PRODUCER);

				expect(() => condVar.wait(label, LockedOperation.NOOP)).to.throw(
					`Lock acquired for label ${label} on ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.READ)} operation. ` +
						`Only ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.READ)} operation can be requested. ` +
						`Given: ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.NOOP)}.`
				);

				expect(() => condVar.wait(label, LockedOperation.WRITE)).to.throw(
					`Lock acquired for label ${label} on ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.READ)} operation. ` +
						`Only ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.READ)} operation can be requested. ` +
						`Given: ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.WRITE)}.`
				);

				expect(() => condVar.wait(label, LockedOperation.WRITE | LockedOperation.READ)).to.throw(
					`Lock acquired for label ${label} on ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.READ)} operation. ` +
						`Only ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.READ)} operation can be requested. ` +
						`Given: ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.WRITE | LockedOperation.READ)}.`
				);

				condVar.notifyAll(label, null);
				expect(await waitStatusProd.promise).to.be.eq(null);
			});

			it('read -> read (success)', async () => {
				const condVar = new LabeledConditionalVariable();
				const label = 'label';

				const waitStatusProd = condVar.wait(label, LockedOperation.READ);
				expect(waitStatusProd.role).to.be.eq(AwaiterRole.PRODUCER);

				const waitStatusCons = condVar.wait(label, LockedOperation.READ);
				expect(waitStatusCons.role).to.be.eq(AwaiterRole.CONSUMER);

				condVar.notifyAll(label, null);
				expect(await waitStatusProd.promise).to.be.eq(null);
			});

			it('read & write -> any (failure)', async () => {
				const condVar = new LabeledConditionalVariable();
				const label = 'label';

				const waitStatusProd = condVar.wait(label, LockedOperation.READ | LockedOperation.WRITE);
				expect(waitStatusProd.role).to.be.eq(AwaiterRole.PRODUCER);

				expect(() => condVar.wait(label, LockedOperation.NOOP)).to.throw(
					`Lock acquired for label ${label} on ${LabeledConditionalVariable.formatLockedOperation(
						LockedOperation.READ | LockedOperation.WRITE
					)} operation, which is an exclusive one. Given: ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.NOOP)}.`
				);

				expect(() => condVar.wait(label, LockedOperation.READ)).to.throw(
					`Lock acquired for label ${label} on ${LabeledConditionalVariable.formatLockedOperation(
						LockedOperation.READ | LockedOperation.WRITE
					)} operation, which is an exclusive one. Given: ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.READ)}.`
				);

				expect(() => condVar.wait(label, LockedOperation.WRITE)).to.throw(
					`Lock acquired for label ${label} on ${LabeledConditionalVariable.formatLockedOperation(
						LockedOperation.READ | LockedOperation.WRITE
					)} operation, which is an exclusive one. Given: ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.WRITE)}.`
				);

				expect(() => condVar.wait(label, LockedOperation.WRITE | LockedOperation.READ)).to.throw(
					`Lock acquired for label ${label} on ${LabeledConditionalVariable.formatLockedOperation(
						LockedOperation.READ | LockedOperation.WRITE
					)} operation, which is an exclusive one. ` +
						`Given: ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.WRITE | LockedOperation.READ)}.`
				);

				expect(() => condVar.wait(label, LockedOperation.NOOP | LockedOperation.WRITE | LockedOperation.READ)).to.throw(
					`Lock acquired for label ${label} on ${LabeledConditionalVariable.formatLockedOperation(
						LockedOperation.READ | LockedOperation.WRITE
					)} operation, which is an exclusive one. ` +
						`Given: ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.NOOP | LockedOperation.WRITE | LockedOperation.READ)}.`
				);

				condVar.notifyAll(label, null);
				expect(await waitStatusProd.promise).to.be.eq(null);
			});
		});
	});

	describe('notifyAll spec', () => {
		it('releases acquired lock with result', async () => {
			const mutex = new LabeledConditionalVariable();
			const label = 'key';
			const result = 1;

			const waitStatus = mutex.wait(label);
			expect(waitStatus.role).to.be.eq(AwaiterRole.PRODUCER);
			mutex.notifyAll(label, result);

			expect(await waitStatus.promise).to.be.eq(result);
		});

		it('releases acquired lock with error', async () => {
			const mutex = new LabeledConditionalVariable();
			const label = 'key';
			const error = new Error('Operation failed');

			const waitStatus = mutex.wait(label);
			expect(waitStatus.role).to.be.eq(AwaiterRole.PRODUCER);
			mutex.notifyAll(label, error);

			await expect(waitStatus.promise).to.be.rejectedWith(error);
		});

		it('releases acquired lock to multiple consumers', async () => {
			const mutex = new LabeledConditionalVariable();

			const label = 'key';
			const result = 0;
			const consumersNo = 10;

			const promises: Array<Promise<number>> = new Array<Promise<number>>(consumersNo);
			for (let i = 0; i < consumersNo; i++) {
				promises[i] = mutex.wait(label).promise;
			}

			mutex.notifyAll(label, result);

			expect(await Promise.all(promises)).to.be.equalTo(array.filledWith(consumersNo, result));
		});

		it('clears timeout on explicit notifyAll', async () => {
			const mutex = new LabeledConditionalVariable();

			const label = '';
			const timeout = 10;
			const result = null;

			const waitStatus = mutex.wait(label, LockedOperation.NOOP, timeout);
			expect(waitStatus.role).to.be.eq(AwaiterRole.PRODUCER);

			mutex.notifyAll(label, result);
			expect(await waitStatus.promise).to.be.eq(result);

			await chrono.sleep(10);
			expect(await waitStatus.promise).to.be.eq(result);
		});

		it("fails to notifyAll lock which wasn't acquired", () => {
			const mutex = new LabeledConditionalVariable();
			expect(() => mutex.notifyAll('key')).to.throw(`No lock found for label key.`);
		});

		it('fails to notifyAll same lock multiple times', async () => {
			const mutex = new LabeledConditionalVariable();
			const label = 'key';

			const waitStatus = mutex.wait(label);
			expect(waitStatus.role).to.be.eq(AwaiterRole.PRODUCER);

			mutex.notifyAll(label);
			expect(await waitStatus.promise).to.be.eq(undefined);

			expect(() => mutex.notifyAll(label)).to.throw(`No lock found for label ${label}.`);
		});

		it('fails to notifyAll lock after timeout', async () => {
			const mutex = new LabeledConditionalVariable();
			const label = 'key';
			const timeout = 10;

			const waitStatus = mutex.wait(label, LockedOperation.NOOP, timeout);
			expect(waitStatus.role).to.be.eq(AwaiterRole.PRODUCER);

			await expect(waitStatus.promise).to.be.rejectedWith(`Timeout of ${timeout} ms for label ${label} has been exceeded.`);
			expect(() => mutex.notifyAll(label)).to.throw(`No lock found for label ${label}.`);
		});
	});

	describe('forcedNotify spec', () => {
		it('releases forcibly a set of labels', async () => {
			const mutex = new LabeledConditionalVariable();
			const labels = [1, 2, 3, 4, 5, 6].map((n) => n.toString());

			const promises: Array<Promise<any>> = new Array(labels.length);
			for (let i = 0; i < labels.length; i++) {
				promises[i] = mutex.wait(labels[i]).promise;
			}

			const toForceRelease = new Set();
			for (let i = 0; i < labels.length / 2; i++) {
				toForceRelease.add(labels[number.randomInt(0, labels.length - 1)]);
			}

			mutex.forcedNotify((label: string) => toForceRelease.has(label));

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

	describe('lockedRun spec', () => {
		it('computes value and returns to producer', async () => {
			const condVar = new LabeledConditionalVariable();
			const label = 'label';

			const result = null;
			function provider(): Promise<any> {
				return Promise.resolve(result);
			}

			expect(await condVar.lockedRun(label, LockedOperation.NOOP, null, provider)).to.be.eq(result);
		});

		it('computes value and returns to producer and consumers', async () => {
			const condVar = new LabeledConditionalVariable();
			const label = 'label';

			const result = '';
			function provider(): Promise<any> {
				return new Promise<any>((resolve) => {
					setTimeout(() => resolve(result), 10);
				});
			}

			const results = 10;
			const requests = array.filledWith(results, () => condVar.lockedRun(label, LockedOperation.NOOP, null, provider));
			const responses = await Promise.all(requests);
			expect(responses).to.be.equalTo(array.filledWith(results, result));
		});

		it('calls provider only once, consumers are just waiting on promise synchronization', async () => {
			const condVar = new LabeledConditionalVariable();
			const label = 'label';

			const result = 0;
			let calls = 0;
			function provider(): Promise<any> {
				calls += 1;
				return new Promise<any>((resolve) => {
					setTimeout(() => resolve(result), 10);
				});
			}

			const results = 10;
			const requests = array.filledWith(results, () => condVar.lockedRun(label, LockedOperation.NOOP, null, provider));
			const responses = await Promise.all(requests);

			expect(calls).to.be.eq(1);
			expect(responses).to.be.equalTo(array.filledWith(results, result));
		});

		it('passes args to provider', async () => {
			const condVar = new LabeledConditionalVariable();
			const label = 'label';

			const firstResultPart = 0;
			const secondResultPart = '1';

			function computeResult(first: number, second: string): string {
				return first + second;
			}
			function provider(first: number, second: string): Promise<any> {
				return new Promise<any>((resolve) => {
					setTimeout(resolve, 10, computeResult(first, second));
				});
			}

			const result = await condVar.lockedRun(label, LockedOperation.NOOP, null, provider, firstResultPart, secondResultPart);

			expect(result).to.be.eq(computeResult(firstResultPart, secondResultPart));
		});

		it('rejects all consumers and producer with the error of the provider', async () => {
			const condVar = new LabeledConditionalVariable();
			const label = 'label';

			const error = new Error('1 + 1 = ¯\\_(ツ)_/¯');
			function provider(): Promise<any> {
				return new Promise<any>((_resolve, reject) => {
					setTimeout(reject, 10, error);
				});
			}

			const results = 10;
			const requests = array.filledWith(results, () => condVar.lockedRun(label, LockedOperation.NOOP, null, provider));

			expect(requests.length).to.be.eq(results);
			for (const request of requests) {
				await expect(request).to.be.rejectedWith(error);
			}
		});

		it('rejects if operation is mutual exclusive and returns result to producer (read -> write)', async () => {
			const condVar = new LabeledConditionalVariable();
			const label = 'label';

			const result = undefined;
			function provider(): Promise<any> {
				return new Promise<any>((resolve) => {
					setTimeout(resolve, 10);
				});
			}

			const readPromise = condVar.lockedRun(label, LockedOperation.READ, null, provider);
			const writePromise = condVar.lockedRun(label, LockedOperation.WRITE, null, provider);

			expect(readPromise === writePromise).to.be.eq(false);

			let err;
			try {
				await writePromise;
			} catch (e) {
				err = e;
			}
			expect(err.emitter).to.be.eq(Library.ASYNC);
			expect(err.code).to.be.eq(ErrorCodes.UNABLE_TO_LOCK);
			expect(err.message).to.be.eq(
				`Lock acquired for label ${label} on ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.READ)} operation. ` +
					`Only ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.READ)} operation can be requested. ` +
					`Given: ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.WRITE)}.`
			);
			expect(err.cause).to.be.eq(undefined);

			expect(await readPromise).to.be.eq(result);
		});

		it('rejects if operation is mutual exclusive and returns result to producer (write -> any)', async () => {
			const condVar = new LabeledConditionalVariable();
			const label = 'label';

			const result = undefined;
			function provider(): Promise<any> {
				return new Promise<any>((resolve) => {
					setTimeout(resolve, 10);
				});
			}

			const writePromise = condVar.lockedRun(label, LockedOperation.WRITE, null, provider);
			const readPromise = condVar.lockedRun(label, LockedOperation.READ, null, provider);

			expect(writePromise === readPromise).to.be.eq(false);

			let err;
			try {
				await readPromise;
			} catch (e) {
				err = e;
			}
			expect(err.emitter).to.be.eq(Library.ASYNC);
			expect(err.code).to.be.eq(ErrorCodes.UNABLE_TO_LOCK);
			expect(err.message).to.be.eq(
				`Lock acquired for label ${label} on ${LabeledConditionalVariable.formatLockedOperation(
					LockedOperation.WRITE
				)} operation, which is an exclusive one. Given: ${LabeledConditionalVariable.formatLockedOperation(LockedOperation.READ)}.`
			);
			expect(err.cause).to.be.eq(undefined);

			expect(await writePromise).to.be.eq(result);
		});

		it('rejects producers and consumers on timeout', async () => {
			const condVar = new LabeledConditionalVariable();
			const label = 'label';

			const result = false;
			const consumers = 5;
			const notifyTimeout = 10;
			const providerTimeout = notifyTimeout * 2;

			function provider(): Promise<any> {
				return new Promise<any>((resolve) => {
					setTimeout(resolve, providerTimeout, result);
				});
			}

			let rejections = 0;

			const producerPromise = condVar
				.lockedRun(label, LockedOperation.NOOP, notifyTimeout, provider)
				.then(() => {
					throw new Error('Should not resolve');
				})
				.catch((e) => {
					rejections += 1;
					expect(e.message).to.be.eq(`Timeout of ${notifyTimeout} ms for label ${label} has been exceeded.`);
				});
			const consumersPromises = array
				.filledWith(consumers, () => condVar.lockedRun(label, LockedOperation.NOOP, null, provider))
				.map((promise) => {
					return promise
						.then(() => {
							throw new Error('Should not resolve');
						})
						.catch((e) => {
							rejections += 1;
							expect(e.message).to.be.eq(`Timeout of ${notifyTimeout} ms for label ${label} has been exceeded.`);
						});
				});

			await Promise.all([producerPromise].concat(consumersPromises));
			expect(rejections).to.be.eq(consumers + 1);

			await chrono.sleep(providerTimeout - notifyTimeout);
		});
	});

	describe('formatters spec', () => {
		it('formats awaiter', () => {
			expect(LabeledConditionalVariable.formatAwaiterRole(AwaiterRole.PRODUCER)).to.be.eq('PRODUCER');
			expect(LabeledConditionalVariable.formatAwaiterRole(AwaiterRole.CONSUMER)).to.be.eq('CONSUMER');
			expect(() => LabeledConditionalVariable.formatAwaiterRole(-1)).to.throw(`Awaiter role is not valid. Given ${-1}.`);
		});

		it('formats locked operation', () => {
			expect(LabeledConditionalVariable.formatLockedOperation(LockedOperation.NOOP)).to.be.eq('Noop');
			expect(LabeledConditionalVariable.formatLockedOperation(LockedOperation.READ)).to.be.eq('Read');
			expect(LabeledConditionalVariable.formatLockedOperation(LockedOperation.WRITE)).to.be.eq('Write');
			expect(LabeledConditionalVariable.formatLockedOperation(LockedOperation.WRITE | LockedOperation.READ)).to.be.eq('ReadWrite');
			expect(() => LabeledConditionalVariable.formatLockedOperation(-1)).to.throw(`Requested an unknown operation ${-1}.`);
		});
	});
});

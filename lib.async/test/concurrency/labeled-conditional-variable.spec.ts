import { describe, it } from 'mocha';
import { chai } from '@thermopylae/lib.unit-test';
import { array, chrono, number } from '@thermopylae/lib.utils';
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

			const promises: Array<Promise<number>> = new Array<Promise<number>>(consumersNo);
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

			expect(() => mutex.wait(label, LockedOperation.NOOP, -1)).to.throw(`Timeout ranges between 0 and ${LabeledConditionalVariable.MAX_TIMEOUT}.`);
			expect(() => mutex.wait(label, LockedOperation.NOOP, LabeledConditionalVariable.MAX_TIMEOUT + 1)).to.throw(
				`Timeout ranges between 0 and ${LabeledConditionalVariable.MAX_TIMEOUT}.`
			);
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

			const waitStatus = mutex.wait(label, timeout);
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
				toForceRelease.add(labels[number.generateRandomInt(0, labels.length - 1)]);
			}

			mutex.forcedNotify((label) => toForceRelease.has(label));

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
});

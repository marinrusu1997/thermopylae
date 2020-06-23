import { describe, it } from 'mocha';
import { chai } from '@thermopylae/lib.unit-test';
import { chrono, array, number } from '@thermopylae/lib.utils';
import { LabeledConditionalVariable } from '../../lib/concurrency';
import { ErrorCodes } from '../../lib';

const { expect } = chai;

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

		await chrono.sleep(20);

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

		mutex.forcedNotify();

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

		await chrono.sleep(10);
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

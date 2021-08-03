import { describe, it } from 'mocha';
import { chai } from '@thermopylae/dev.unit-test';
import { array, chrono, number } from '@thermopylae/lib.utils';
import { AsyncFunction, Optional } from '@thermopylae/core.declarations';
import { AwaiterRole, LabeledConditionalVariableManager, LockedOperationType, ErrorCodes } from '../../lib';

const { expect } = chai;

// eslint-disable-next-line mocha/no-setup-in-describe
describe(`${LabeledConditionalVariableManager.name} spec`, () => {
	describe('wait spec', () => {
		it('acquires mutex for a given label', () => {
			const mutex = new LabeledConditionalVariableManager();
			expect(mutex.wait('label', LockedOperationType.READ).role).to.be.eq(AwaiterRole.PRODUCER);
		});

		it("doesn't wait mutex if it was acquired already", () => {
			const mutex = new LabeledConditionalVariableManager();

			let waitStatus = mutex.wait('label', LockedOperationType.READ);
			expect(waitStatus.role).to.be.eq(AwaiterRole.PRODUCER);
			expect(waitStatus.promise).to.be.an.instanceOf(Promise);

			waitStatus = mutex.wait('label', LockedOperationType.READ);
			expect(waitStatus.role).to.be.eq(AwaiterRole.CONSUMER);
			expect(waitStatus.promise).to.be.an.instanceOf(Promise);
		});

		it("timeouts lock if it wasn't released in the given interval", async () => {
			const mutex = new LabeledConditionalVariableManager();
			const timeout = 10;
			const label = 'key';

			const acquireStart = Date.now();
			const { role, promise } = mutex.wait(label, LockedOperationType.READ, timeout);

			expect(role).to.be.eq(AwaiterRole.PRODUCER);
			await expect(promise).to.be.rejectedWith(`Timeout of ${timeout} ms for label '${label}' has been exceeded.`);
			// @ts-ignore
			expect(Date.now() - acquireStart).to.be.in.range(timeout, timeout + 20);
		});

		it("won't timeout the lock if it's value is 0", async () => {
			const mutex = new LabeledConditionalVariableManager();
			const timeout = 0;
			const label = 'key';

			const { role, promise } = mutex.wait(label, LockedOperationType.READ, timeout);
			expect(role).to.be.eq(AwaiterRole.PRODUCER);

			await chrono.sleep(20);

			mutex.notifyAll(label, '');
			expect(await promise).to.be.eq('');
		});

		it('acquires lock again if it was timeout-ed', async () => {
			const mutex = new LabeledConditionalVariableManager();
			const label = 'key';
			let timeout = 10;

			const { promise, role } = mutex.wait(label, LockedOperationType.READ, timeout);
			expect(role).to.be.eq(AwaiterRole.PRODUCER);
			expect(mutex.wait(label, LockedOperationType.READ, timeout).role).to.be.eq(AwaiterRole.CONSUMER);
			await expect(promise).to.be.rejectedWith(`Timeout of ${timeout} ms for label '${label}' has been exceeded.`);

			timeout = 20;
			const waitStatus = mutex.wait(label, LockedOperationType.READ, timeout);
			expect(waitStatus.role).to.be.eq(AwaiterRole.PRODUCER);
			await expect(waitStatus.promise).to.be.rejectedWith(`Timeout of ${timeout} ms for label '${label}' has been exceeded.`);
		});

		it("multiple consumers can wait same mutex and won't deadlock", async () => {
			const mutex = new LabeledConditionalVariableManager<string, number>();
			const label = 'key';
			const consumersNo = 10;

			const promises = new Array<Promise<Optional<number>>>(consumersNo);
			for (let i = 0; i < consumersNo; i++) {
				promises[i] = mutex.wait(label, LockedOperationType.READ).promise;
			}

			for (let i = 1; i < consumersNo; i++) {
				expect(promises[i]).to.be.eq(promises[0]);
			}

			mutex.forcedNotify('@all');

			await expect(Promise.all(promises)).to.be.rejectedWith(`Label '${label}' has been released forcibly.`);
		});

		it('fails to lock on unknown operation', () => {
			const mutex = new LabeledConditionalVariableManager();
			const label = 'key';
			expect(() => mutex.wait(label, -1)).to.throw(`Requested an unknown operation '${-1}'.`);
		});

		describe('operations overlap spec', () => {
			it('write -> any (failure)', async () => {
				const condVar = new LabeledConditionalVariableManager();
				const label = 'label';

				const waitStatusProd = condVar.wait(label, LockedOperationType.WRITE);
				expect(waitStatusProd.role).to.be.eq(AwaiterRole.PRODUCER);

				expect(() => condVar.wait(label, LockedOperationType.READ)).to.throw(
					`Lock acquired for label '${label}' on ${LabeledConditionalVariableManager.formatLockedOperation(
						LockedOperationType.WRITE
					)} operation, which is an exclusive one. Given: ${LabeledConditionalVariableManager.formatLockedOperation(LockedOperationType.READ)}.`
				);

				expect(() => condVar.wait(label, LockedOperationType.WRITE)).to.throw(
					`Lock acquired for label '${label}' on ${LabeledConditionalVariableManager.formatLockedOperation(
						LockedOperationType.WRITE
					)} operation, which is an exclusive one. Given: ${LabeledConditionalVariableManager.formatLockedOperation(LockedOperationType.WRITE)}.`
				);

				condVar.notifyAll(label, null);
				expect(await waitStatusProd.promise).to.be.eq(null);
			});

			it('read -> write (failure)', async () => {
				const condVar = new LabeledConditionalVariableManager();
				const label = 'label';

				const waitStatusProd = condVar.wait(label, LockedOperationType.READ);
				expect(waitStatusProd.role).to.be.eq(AwaiterRole.PRODUCER);

				expect(() => condVar.wait(label, LockedOperationType.WRITE)).to.throw(
					`Lock acquired for label '${label}' on ${LabeledConditionalVariableManager.formatLockedOperation(LockedOperationType.READ)} operation. ` +
						`Only ${LabeledConditionalVariableManager.formatLockedOperation(LockedOperationType.READ)} operation can be requested. ` +
						`Given: ${LabeledConditionalVariableManager.formatLockedOperation(LockedOperationType.WRITE)}.`
				);

				condVar.notifyAll(label, null);
				expect(await waitStatusProd.promise).to.be.eq(null);
			});

			it('read -> read (success)', async () => {
				const condVar = new LabeledConditionalVariableManager();
				const label = 'label';

				const waitStatusProd = condVar.wait(label, LockedOperationType.READ);
				expect(waitStatusProd.role).to.be.eq(AwaiterRole.PRODUCER);

				const waitStatusCons = condVar.wait(label, LockedOperationType.READ);
				expect(waitStatusCons.role).to.be.eq(AwaiterRole.CONSUMER);

				condVar.notifyAll(label, null);
				expect(await waitStatusProd.promise).to.be.eq(null);
			});
		});
	});

	describe('notifyAll spec', () => {
		it('releases acquired lock with result', async () => {
			const mutex = new LabeledConditionalVariableManager();
			const label = 'key';
			const result = 1;

			const waitStatus = mutex.wait(label, LockedOperationType.READ);
			expect(waitStatus.role).to.be.eq(AwaiterRole.PRODUCER);
			mutex.notifyAll(label, result);

			expect(await waitStatus.promise).to.be.eq(result);
		});

		it('releases acquired lock with error', async () => {
			const mutex = new LabeledConditionalVariableManager();
			const label = 'key';
			const error = new Error('Operation failed');

			const waitStatus = mutex.wait(label, LockedOperationType.READ);
			expect(waitStatus.role).to.be.eq(AwaiterRole.PRODUCER);
			mutex.notifyAll(label, error);

			await expect(waitStatus.promise).to.be.rejectedWith(error);
		});

		it('releases acquired lock to multiple consumers', async () => {
			const mutex = new LabeledConditionalVariableManager();

			const label = 'key';
			const result = 0;
			const consumersNo = 10;

			const promises: Array<Promise<number>> = new Array<Promise<number>>(consumersNo);
			for (let i = 0; i < consumersNo; i++) {
				promises[i] = mutex.wait(label, LockedOperationType.READ).promise;
			}

			mutex.notifyAll(label, result);

			expect(await Promise.all(promises)).to.be.equalTo(array.filledWith(consumersNo, result));
		});

		it('clears timeout on explicit notifyAll', async () => {
			const mutex = new LabeledConditionalVariableManager();

			const label = '';
			const timeout = 10;
			const result = null;

			const waitStatus = mutex.wait(label, LockedOperationType.READ, timeout);
			expect(waitStatus.role).to.be.eq(AwaiterRole.PRODUCER);

			mutex.notifyAll(label, result);
			expect(await waitStatus.promise).to.be.eq(result);

			await chrono.sleep(10);
			expect(await waitStatus.promise).to.be.eq(result);
		});

		it("fails to notifyAll lock which wasn't acquired", () => {
			const mutex = new LabeledConditionalVariableManager();
			expect(() => mutex.notifyAll('key')).to.throw(`No lock found for label 'key'.`);
		});

		it('fails to notifyAll same lock multiple times', async () => {
			const mutex = new LabeledConditionalVariableManager();
			const label = 'key';

			const waitStatus = mutex.wait(label, LockedOperationType.READ);
			expect(waitStatus.role).to.be.eq(AwaiterRole.PRODUCER);

			mutex.notifyAll(label);
			expect(await waitStatus.promise).to.be.eq(undefined);

			expect(() => mutex.notifyAll(label)).to.throw(`No lock found for label '${label}'.`);
		});

		it('fails to notifyAll lock after timeout', async () => {
			const mutex = new LabeledConditionalVariableManager();
			const label = 'key';
			const timeout = 10;

			const waitStatus = mutex.wait(label, LockedOperationType.READ, timeout);
			expect(waitStatus.role).to.be.eq(AwaiterRole.PRODUCER);

			await expect(waitStatus.promise).to.be.rejectedWith(`Timeout of ${timeout} ms for label '${label}' has been exceeded.`);
			expect(() => mutex.notifyAll(label)).to.throw(`No lock found for label '${label}'.`);
		});
	});

	describe('forcedNotify spec', () => {
		it('releases forcibly a set of labels', async () => {
			const mutex = new LabeledConditionalVariableManager();
			const labels = [1, 2, 3, 4, 5, 6].map((n) => n.toString());

			const promises: Array<Promise<any>> = new Array(labels.length);
			for (let i = 0; i < labels.length; i++) {
				promises[i] = mutex.wait(labels[i], LockedOperationType.READ).promise;
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
			expect(err.message).to.be.oneOf(Array.from(toForceRelease).map((label) => `Label '${label}' has been released forcibly.`));

			for (let i = 0; i < labels.length; i++) {
				if (!toForceRelease.has(labels[i])) {
					mutex.notifyAll(labels[i], Infinity);
					expect(await promises[i]).to.be.eq(Infinity);
				}
			}

			expect(mutex.size).to.be.eq(0);
		});
	});

	describe('cache example', () => {
		class Cache {
			// acts as Read-Write Lock, i.e. shared for Reads, exclusive for Writes
			private readonly conditionalVariable: LabeledConditionalVariableManager<string, string>;

			private readonly entries: Map<string, string>; // assuming they will expire somehow

			private readonly storageReader: AsyncFunction<string, string>;

			private readonly storageWriter: AsyncFunction<string, void>;

			public constructor(storageReader: AsyncFunction<string, string>, storageWriter: AsyncFunction<string, void>) {
				this.conditionalVariable = new LabeledConditionalVariableManager();
				this.entries = new Map<string, string>();
				this.storageReader = storageReader;
				this.storageWriter = storageWriter;
			}

			public async get(key: string): Promise<string | undefined> {
				// acquire read-write lock
				// in case it is acquired already by `set` operation, wait will throw
				const lock = await this.conditionalVariable.wait(key, LockedOperationType.READ);

				if (lock.role === AwaiterRole.CONSUMER) {
					// lock has been acquired already by someone who initiated `get` operation for this key
					// just return promise and wait until PRODUCER will resolve/reject it
					return lock.promise;
				}

				let valueOrError = this.entries.get(key);
				if (valueOrError === undefined) {
					try {
						valueOrError = await this.storageReader(key);
						this.entries.set(key, valueOrError);
					} catch (e) {
						valueOrError = e;
					}
				}

				// we are the PRODUCER, so we need to notify ourself and other consumers with value of the key or error that occurred
				// also the lock needs to be released, so that `set` operation can acquire it
				this.conditionalVariable.notifyAll(key, valueOrError);
				return lock.promise;
			}

			public async set(key: string, value: string): Promise<void> {
				// acquire exclusive lock
				// in case it is acquired already by `set` or `get` cache operations, wait will throw
				await this.conditionalVariable.wait(key, LockedOperationType.WRITE);

				// there is no need to check for producer consumer roles,
				// because WRITE lock is either acquired, or an error is thrown

				try {
					await this.storageWriter(key, value);
					this.entries.set(key, value);
				} finally {
					// release exclusive lock, so it can be used by either `set` or `get` cache operations
					this.conditionalVariable.notifyAll(key);
				}
			}
		}

		function getReader(throwable: Error | null = null) {
			return function reader(key: string): Promise<string> {
				return new Promise((resolve, reject) => {
					setTimeout(() => {
						return throwable === null ? resolve(key) : reject(throwable);
					}, 30);
				});
			};
		}

		function getWriter(throwable: Error | null = null) {
			return function writer(): Promise<void> {
				return new Promise((resolve, reject) => {
					setTimeout(() => {
						return throwable === null ? resolve() : reject(throwable);
					}, 30);
				});
			};
		}

		it('allows multiple simultaneous reads', async () => {
			const cache = new Cache(getReader(), getWriter());

			let values = await Promise.all([cache.get('key'), cache.get('key'), cache.get('key')]);
			expect(values).to.be.equalTo(['key', 'key', 'key']);

			values = await Promise.all([cache.get('key'), cache.get('key'), cache.get('key')]);
			expect(values).to.be.equalTo(['key', 'key', 'key']);
		});

		it('allows multiple simultaneous reads and notifies about failure', async () => {
			const err = new Error('demo');
			const cache = new Cache(getReader(err), getWriter());

			let values = await Promise.allSettled([cache.get('key'), cache.get('key'), cache.get('key')]);
			expect(values).to.be.ofSize(3);
			for (const value of values) {
				expect(value.status).to.be.eq('rejected');
				// @ts-ignore
				expect(value.reason).to.be.eq(err);
			}

			values = await Promise.allSettled([cache.get('key'), cache.get('key'), cache.get('key')]);
			expect(values).to.be.ofSize(3);
			for (const value of values) {
				expect(value.status).to.be.eq('rejected');
				// @ts-ignore
				expect(value.reason).to.be.eq(err);
			}
		});

		it('notifies about error while performing write', async () => {
			const err = new Error('demo');
			const cache = new Cache(getReader(), getWriter(err));

			await expect(cache.set('key', 'value')).to.eventually.be.rejectedWith(err);
			await expect(cache.get('key')).to.eventually.be.eq('key');
		});

		it("doesn't allow read while write is performing", async () => {
			const cache = new Cache(getReader(), getWriter());

			const results = await Promise.allSettled([cache.set('key', 'value'), cache.get('key')]);
			expect(results).to.be.ofSize(2);

			expect(results[0].status).to.be.eq('fulfilled');
			expect(results[1].status).to.be.eq('rejected');
			// @ts-ignore
			expect(results[1].reason.message).to.be.eq("Lock acquired for label 'key' on WRITE operation, which is an exclusive one. Given: READ.");

			await expect(cache.get('key')).to.eventually.be.eq('value');
		});

		it("doesn't allow write while write is performing", async () => {
			const cache = new Cache(getReader(), getWriter());

			const results = await Promise.allSettled([cache.set('key', 'value'), cache.set('key', 'value2')]);
			expect(results).to.be.ofSize(2);

			expect(results[0].status).to.be.eq('fulfilled');
			expect(results[1].status).to.be.eq('rejected');
			// @ts-ignore
			expect(results[1].reason.message).to.be.eq("Lock acquired for label 'key' on WRITE operation, which is an exclusive one. Given: WRITE.");

			await expect(cache.get('key')).to.eventually.be.eq('value');
		});

		it("doesn't allow write while read is performing", async () => {
			const cache = new Cache(getReader(), getWriter());

			const results = await Promise.allSettled([cache.get('key'), cache.set('key', 'value')]);
			expect(results).to.be.ofSize(2);

			expect(results[0].status).to.be.eq('fulfilled');
			// @ts-ignore
			expect(results[0].value).to.be.eq('key');
			expect(results[1].status).to.be.eq('rejected');
			// @ts-ignore
			expect(results[1].reason.message).to.be.eq("Lock acquired for label 'key' on READ operation. Only READ operation can be requested. Given: WRITE.");

			await expect(cache.get('key')).to.eventually.be.eq('key');
		});
	});

	describe('formatters spec', () => {
		it('formats awaiter', () => {
			expect(LabeledConditionalVariableManager.formatAwaiterRole(AwaiterRole.PRODUCER)).to.be.eq('PRODUCER');
			expect(LabeledConditionalVariableManager.formatAwaiterRole(AwaiterRole.CONSUMER)).to.be.eq('CONSUMER');
			expect(() => LabeledConditionalVariableManager.formatAwaiterRole(-1)).to.throw(`Awaiter role is not valid. Given: ${-1}.`);
		});

		it('formats locked operation', () => {
			expect(LabeledConditionalVariableManager.formatLockedOperation(LockedOperationType.READ)).to.be.eq('READ');
			expect(LabeledConditionalVariableManager.formatLockedOperation(LockedOperationType.WRITE)).to.be.eq('WRITE');
			expect(() => LabeledConditionalVariableManager.formatLockedOperation(-1)).to.throw(`Requested an unknown operation '${-1}'.`);
		});
	});
});

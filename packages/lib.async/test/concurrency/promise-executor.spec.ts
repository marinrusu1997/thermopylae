// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it } from 'mocha';
import { chai } from '@thermopylae/dev.unit-test';
import { chrono, array } from '@thermopylae/lib.utils';
import { PromiseExecutor } from '../../lib';

const { expect } = chai;

// eslint-disable-next-line mocha/no-setup-in-describe
describe(`${PromiseExecutor.name} spec`, () => {
	it('processes data in sequential order', async () => {
		const items = 10;
		const duration = 100;
		async function longRunningProcessor(): Promise<null> {
			await chrono.sleep(duration);
			return null;
		}

		const start = Date.now();
		await PromiseExecutor.run<null, null>(longRunningProcessor, array.filledWith(items, null), PromiseExecutor.SEQUENTIAL);
		const end = Date.now();

		const expectedDuration = items * duration;
		// @ts-ignore This is for test purposes
		expect(end - start).to.be.in.range(expectedDuration - duration, expectedDuration + duration);
	});

	it('processes data in parallel order', async () => {
		const items = 10;
		const duration = 100;
		const epsilon = 20;
		async function longRunningProcessor(): Promise<null> {
			await chrono.sleep(duration);
			return null;
		}

		const start = Date.now();
		await PromiseExecutor.run<null, null>(longRunningProcessor, array.filledWith(items, null), PromiseExecutor.PARALLEL);
		const end = Date.now();

		const expectedDuration = duration;
		// @ts-ignore This is for test purposes
		expect(end - start).to.be.in.range(expectedDuration - epsilon, expectedDuration + epsilon);
	});

	it('processes data in batches', async () => {
		const items = 10;
		const duration = 100;
		const epsilon = 50;
		const concurrency = 2;
		async function longRunningProcessor(): Promise<null> {
			await chrono.sleep(duration);
			return null;
		}

		const start = Date.now();
		await PromiseExecutor.run<null, null>(longRunningProcessor, array.filledWith(items, null), concurrency);
		const end = Date.now();

		const expectedDuration = (items * duration) / concurrency;
		// @ts-ignore This is for test purposes
		expect(end - start).to.be.in.range(expectedDuration - epsilon, expectedDuration + epsilon);
	});

	it('creates a runnable command', async () => {
		const items = 10;
		const duration = 100;
		async function longRunningProcessor(): Promise<null> {
			await chrono.sleep(duration);
			return null;
		}

		const command = PromiseExecutor.command<null, null>(longRunningProcessor, array.filledWith(items, null), PromiseExecutor.SEQUENTIAL);

		const start = Date.now();
		await command.execute();
		const end = Date.now();

		const expectedDuration = items * duration;
		// @ts-ignore This is for test purposes
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

	it('formats concurrency', () => {
		let concurrency = 2;

		expect(PromiseExecutor.formatConcurrency(PromiseExecutor.SEQUENTIAL)).to.be.eq('SEQUENTIAL');
		expect(PromiseExecutor.formatConcurrency(PromiseExecutor.PARALLEL)).to.be.eq('PARALLEL');
		expect(PromiseExecutor.formatConcurrency(concurrency)).to.be.eq(`BATCHES OF ${concurrency} TASKS`);

		concurrency = 1;
		expect(() => PromiseExecutor.formatConcurrency(concurrency)).to.throw(
			`Concurrency needs to have a min value of 2. Provided concurrency: ${concurrency}. ` +
				`For sequential concurrency please provide ${PromiseExecutor.SEQUENTIAL} value.`
		);
		concurrency = -1;
		expect(() => PromiseExecutor.formatConcurrency(concurrency)).to.throw(
			`Concurrency needs to have a min value of 2. Provided concurrency: ${concurrency}. `
		);
	});
});

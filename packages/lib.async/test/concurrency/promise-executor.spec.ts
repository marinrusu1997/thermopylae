import { array, chrono } from '@thermopylae/lib.utils';
import { describe, expect, it } from 'vitest';
import { PromiseExecutor } from '../../lib/index.js';

describe(`${PromiseExecutor.name} spec`, () => {
	it('processes data in sequential order', async () => {
		const items = 10;
		const sleepDuration = 100;
		async function longRunningProcessor(): Promise<null> {
			await chrono.sleep(sleepDuration);
			return null;
		}

		const start = Date.now();
		await PromiseExecutor.run<null, null>(longRunningProcessor, array.filledWith(items, null), PromiseExecutor.SEQUENTIAL);
		const end = Date.now();

		const expectedDuration = items * sleepDuration;
		const duration = end - start;
		expect(duration).toBeGreaterThanOrEqual(expectedDuration - duration);
		expect(duration).toBeLessThanOrEqual(expectedDuration + duration);
	});

	it('processes data in parallel order', async () => {
		const items = 10;
		const sleepDuration = 100;
		const epsilon = 20;
		async function longRunningProcessor(): Promise<null> {
			await chrono.sleep(sleepDuration);
			return null;
		}

		const start = Date.now();
		await PromiseExecutor.run<null, null>(longRunningProcessor, array.filledWith(items, null), PromiseExecutor.PARALLEL);
		const end = Date.now();

		const expectedDuration = sleepDuration;
		const duration = end - start;
		expect(duration).toBeGreaterThanOrEqual(expectedDuration - epsilon);
		expect(duration).toBeLessThanOrEqual(expectedDuration + epsilon);
	});

	it('processes data in batches', async () => {
		const ITEMS_NO = 10;
		const SLEEP_DURATION = 100;
		const EPSILON = 50;
		const CONCURRENCY = 2;
		async function longRunningProcessor(): Promise<null> {
			await chrono.sleep(SLEEP_DURATION);
			return null;
		}

		const start = Date.now();
		await PromiseExecutor.run<null, null>(longRunningProcessor, array.filledWith(ITEMS_NO, null), CONCURRENCY);
		const end = Date.now();

		const expectedDuration = (ITEMS_NO * SLEEP_DURATION) / CONCURRENCY;
		const duration = end - start;
		expect(duration).toBeGreaterThanOrEqual(expectedDuration - EPSILON);
		expect(duration).toBeLessThanOrEqual(expectedDuration + EPSILON);
	});

	it('creates a runnable command', async () => {
		const items = 10;
		const sleepDuration = 100;
		async function longRunningProcessor(): Promise<null> {
			await chrono.sleep(sleepDuration);
			return null;
		}

		const command = PromiseExecutor.command<null, null>(longRunningProcessor, array.filledWith(items, null), PromiseExecutor.SEQUENTIAL);

		const start = Date.now();
		await command.execute();
		const end = Date.now();

		const expectedDuration = items * sleepDuration;
		const duration = end - start;
		expect(duration).toBeGreaterThanOrEqual(expectedDuration - duration);
		expect(duration).toBeLessThanOrEqual(expectedDuration + duration);
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

		await expect(PromiseExecutor.run(processor, [], 1)).rejects.toThrow(
			`Concurrency needs to have a min value of 2. Provided concurrency: 1. ` +
				`For sequential concurrency please provide ${PromiseExecutor.SEQUENTIAL} value.`
		);
	});

	it('fails to run with negative concurrency', async () => {
		async function processor(): Promise<null> {
			return null;
		}

		await expect(PromiseExecutor.run(processor, [], -1)).rejects.toThrow(`Concurrency needs to have a min value of 2. Provided concurrency: -1. `);
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

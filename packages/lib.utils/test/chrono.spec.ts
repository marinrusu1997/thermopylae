import { setTimeout as sleep } from 'node:timers/promises';
import { assert, describe, expect, it } from 'vitest';
import { executionTime, executionTimeAsync, firstDayOfNextMonth, tomorrow } from '../lib/chrono.js';

describe('chrono spec', () => {
	describe('measured execution time spec', () => {
		it('measures execution time of sync function', () => {
			const measured = executionTime(
				(a: number, b: number): number => {
					for (let i = 0; i < 1000; i++) {
						// busy waiting
					}
					return a + b;
				},
				null,
				1,
				1
			);

			expect(measured.result).to.be.eq(2);
			expect(measured.time.seconds).to.be.lessThan(1);
		});

		it('measures execution time of async function', async () => {
			async function add(a: number, b: number): Promise<number> {
				await sleep(1000);
				// @ts-expect-error This is just a testa test
				return this.start + a + b;
			}

			const measured = await executionTimeAsync(add, { start: 0 }, 1, 1);
			expect(measured.result).to.be.eq(2);
			expect(measured.time.seconds).to.be.greaterThan(0.99); // depending on floating point computations
		});
	});

	it('computes correctly tomorrow', () => {
		const nowTimestamp = Date.now();
		const tomorrowTimestamp = tomorrow().getTime();
		assert(nowTimestamp < tomorrowTimestamp, 'Tomorrow needs to be greater than current time');
		assert(tomorrowTimestamp - nowTimestamp === 86_400_000, 'Delay between now and tomorrow needs to be one day');
	});

	it('computes first day of next month', () => {
		const nowTimestamp = Date.now();
		const firstDayOfNextMonthTimestamp = firstDayOfNextMonth().getTime();
		assert(firstDayOfNextMonthTimestamp > nowTimestamp, 'First day of next month needs to be greater than current time');
	});
});

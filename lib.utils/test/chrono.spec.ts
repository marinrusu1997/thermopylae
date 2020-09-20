import { chai } from '@thermopylae/lib.unit-test';
import { describe, it } from 'mocha';
import { dateFromUNIX, minutesToSeconds, dateToUNIX, sleep, tomorrow, firstDayOfNextMonth, executionTime, executionTimeAsync } from '../lib/chrono';

const { assert, expect } = chai;

describe('chrono spec', () => {
	describe('measured execution time spec', () => {
		it('measures execution time of sync function', () => {
			function add(a: number, b: number): number {
				for (let i = 0; i < 1000; i++) {
					// busy waiting
				}

				// @ts-ignore
				return this + a + b;
			}

			const measured = executionTime(add, 0, 1, 1);
			expect(measured.result).to.be.eq(2);
			expect(measured.time.seconds).to.be.lessThan(1);
		});

		it('measures execution time of async function', async () => {
			async function add(a: number, b: number): Promise<number> {
				await sleep(1000);
				// @ts-ignore
				return this + a + b;
			}

			const measured = await executionTimeAsync(add, 0, 1, 1);
			expect(measured.result).to.be.eq(2);
			expect(measured.time.seconds).to.be.greaterThan(1);
		});
	});

	it('returns current time in seconds', () => {
		assert(dateToUNIX() === Math.floor(Date.now() / 1000));
	});

	it('returns Date from seconds', () => {
		const now = dateToUNIX();
		const date = dateFromUNIX(now + 10);
		assert(date.getTime() > dateFromUNIX(now).getTime());
		assert(date.getTime() - dateFromUNIX(now).getTime() === 10000);
	});

	it('converts minutes to seconds', () => {
		const now = dateToUNIX();
		const minutes = 5;
		const seconds = minutesToSeconds(minutes);
		assert(dateFromUNIX(now).getTime() < dateFromUNIX(now + seconds).getTime(), 'needs to be greater');
		assert(dateFromUNIX(now + seconds).getTime() - dateFromUNIX(now).getTime() === 300000, 'needs to be 300000 ms');
	});

	it('sleeps for specified amount of milliseconds', (done) => {
		const SLEEP_DURATION = 1000;
		const whenSleepBegan = dateToUNIX();
		sleep(SLEEP_DURATION)
			.then(() => {
				assert(dateToUNIX() - SLEEP_DURATION / 1000 === whenSleepBegan);
				done();
			})
			.catch((error) => done(error));
	});

	it('computes correctly tomorrow', () => {
		const nowUNIX = dateToUNIX();
		const tomorrowUNIX = dateToUNIX(tomorrow());
		assert(nowUNIX < tomorrowUNIX, 'Tomorrow needs to be greater than current time');
		assert(tomorrowUNIX - nowUNIX === 86400, 'Delay between now and tomorrow needs to be one day');
	});

	it('computes first day of next month', () => {
		const nowUNIX = dateToUNIX();
		const firstDayOfNextMonthUnix = dateToUNIX(firstDayOfNextMonth());
		assert(firstDayOfNextMonthUnix > nowUNIX, 'First day of next month needs to be greater than current time');
	});
});

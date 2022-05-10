import { chai } from '@thermopylae/dev.unit-test';
// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it } from 'mocha';
import { fromUnixTime, minutesToSeconds, unixTime, sleep, tomorrow, firstDayOfNextMonth, executionTime, executionTimeAsync } from '../lib/chrono';

const { expect } = chai;
const assert = chai.assert as (expr: boolean, msg?: string) => void;

describe('chrono spec', () => {
	describe('measured execution time spec', () => {
		it('measures execution time of sync function', () => {
			function add(a: number, b: number): number {
				for (let i = 0; i < 1000; i++) {
					// busy waiting
				}

				// @ts-ignore This is just a test
				return this.start + a + b;
			}

			const measured = executionTime(add, { start: 0 }, 1, 1);
			expect(measured.result).to.be.eq(2);
			expect(measured.time.seconds).to.be.lessThan(1);
		});

		it('measures execution time of async function', async () => {
			async function add(a: number, b: number): Promise<number> {
				await sleep(1000);
				// @ts-ignore This is just a test
				return this.start + a + b;
			}

			const measured = await executionTimeAsync(add, { start: 0 }, 1, 1);
			expect(measured.result).to.be.eq(2);
			expect(measured.time.seconds).to.be.greaterThan(0.99); // depending on floating point computations
		});
	});

	it('returns current time in seconds', () => {
		assert(unixTime() === Math.floor(Date.now() / 1000));
	});

	it('returns Date from seconds', () => {
		const now = unixTime();
		const date = fromUnixTime(now + 10);
		assert(date.getTime() > fromUnixTime(now).getTime());
		assert(date.getTime() - fromUnixTime(now).getTime() === 10000);
	});

	it('converts minutes to seconds', () => {
		const now = unixTime();
		const minutes = 5;
		const seconds = minutesToSeconds(minutes);
		assert(fromUnixTime(now).getTime() < fromUnixTime(now + seconds).getTime(), 'needs to be greater');
		assert(fromUnixTime(now + seconds).getTime() - fromUnixTime(now).getTime() === 300000, 'needs to be 300000 ms');
	});

	it('sleeps for specified amount of milliseconds', (done) => {
		const SLEEP_DURATION = 1000;
		const whenSleepBegan = unixTime();
		sleep(SLEEP_DURATION)
			.then(() => {
				assert(unixTime() - SLEEP_DURATION / 1000 === whenSleepBegan);
				done();
			})
			.catch((error) => done(error));
	});

	it('computes correctly tomorrow', () => {
		const nowUNIX = unixTime();
		const tomorrowUNIX = unixTime(tomorrow());
		assert(nowUNIX < tomorrowUNIX, 'Tomorrow needs to be greater than current time');
		assert(tomorrowUNIX - nowUNIX === 86400, 'Delay between now and tomorrow needs to be one day');
	});

	it('computes first day of next month', () => {
		const nowUNIX = unixTime();
		const firstDayOfNextMonthUnix = unixTime(firstDayOfNextMonth());
		assert(firstDayOfNextMonthUnix > nowUNIX, 'First day of next month needs to be greater than current time');
	});
});

import { describe, it } from 'mocha';
import { chai } from './chai';
import { dateFromUNIX, minutesToSeconds, dateToUNIX, sleep, tomorrow, firstDayOfNextMonth } from '../lib/chrono';

const { assert } = chai;

describe('chrono spec', () => {
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

	it('sleeps for specified amount of milliseconds', done => {
		const SLEEP_DURATION = 1000;
		const whenSleepBegan = dateToUNIX();
		sleep(SLEEP_DURATION)
			.then(() => {
				assert(dateToUNIX() - SLEEP_DURATION / 1000 === whenSleepBegan);
				done();
			})
			.catch(error => done(error));
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

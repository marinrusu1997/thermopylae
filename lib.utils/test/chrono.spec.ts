import { describe, it } from 'mocha';
import { chai } from './chai';
import { nowInSeconds, sleep, dateFromSeconds, minutesToSeconds } from '../lib/chrono';

const { assert } = chai;

describe('chrono spec', () => {
	it('returns current time in seconds', () => {
		assert(nowInSeconds() === Math.floor(Date.now() / 1000));
	});

	it('returns Date from seconds', () => {
		const now = nowInSeconds();
		const date = dateFromSeconds(now + 10);
		assert(date.getTime() > dateFromSeconds(now).getTime());
		assert(date.getTime() - dateFromSeconds(now).getTime() === 10000);
	});

	it('converts minutes to seconds', () => {
		const now = nowInSeconds();
		const minutes = 5;
		const seconds = minutesToSeconds(minutes);
		assert(dateFromSeconds(now).getTime() < dateFromSeconds(now + seconds).getTime(), 'needs to be greater');
		assert(dateFromSeconds(now + seconds).getTime() - dateFromSeconds(now).getTime() === 300000, 'needs to be 300000 ms');
	});

	it('sleeps for specified amount of milliseconds', done => {
		const SLEEP_DURATION = 1000;
		const whenSleepBegan = nowInSeconds();
		sleep(SLEEP_DURATION)
			.then(() => {
				assert(nowInSeconds() - SLEEP_DURATION / 1000 === whenSleepBegan);
				done();
			})
			.catch(error => done(error));
	});
});

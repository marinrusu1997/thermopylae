import { describe, it } from 'mocha';
import { chai } from './chai';
import { nowInSeconds, sleep } from '../lib/chrono';

const { assert } = chai;

describe('chrono spec', () => {
	it('returns current time in seconds', () => {
		assert(nowInSeconds() === Math.floor(Date.now() / 1000));
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

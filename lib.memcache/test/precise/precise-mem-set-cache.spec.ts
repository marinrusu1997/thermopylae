import { describe, it } from 'mocha';
import { chrono } from '@thermopylae/lib.utils';
import { PreciseMemSetCache, INFINITE_TTL } from '../../lib';
import { chai } from '../env';
import { ErrorCodes } from '../../lib/error';

const { expect } = chai;

describe('PreciseMemSetCache spec', () => {
	describe('constructor spec', () => {
		it('creates mem cache set using default config', done => {
			const preciseMemSetCache = new PreciseMemSetCache();

			const value = 'value';
			preciseMemSetCache.add(value);

			setTimeout(() => {
				try {
					// by default, items have infinite ttl
					expect(preciseMemSetCache.has(value)).to.be.eq(true);
					done();
				} catch (e) {
					done(e);
				}
			}, 1000);
		});

		it('creates mem cache using explicit config', done => {
			const defaultTtlSec = 1;
			const preciseMemSetCache = new PreciseMemSetCache(defaultTtlSec);

			const value = 'value';
			preciseMemSetCache.add(value);

			setTimeout(() => {
				try {
					// by default, items have 1 sec ttl
					expect(preciseMemSetCache.has(value)).to.be.eq(false);
					done();
				} catch (e) {
					done(e);
				}
			}, defaultTtlSec * 1000 + 50);
		});
	});

	describe('add spec', () => {
		it("does not remove items which don't have tll (i.e ttl provided as 0)", done => {
			const defaultTtlSec = 1;
			const preciseMemSetCache = new PreciseMemSetCache(defaultTtlSec);

			const value = 'value';
			preciseMemSetCache.add(value, INFINITE_TTL);

			setTimeout(() => {
				try {
					// explicit ttl has priority
					expect(preciseMemSetCache.has(value)).to.be.eq(true);
					done();
				} catch (e) {
					done(e);
				}
			}, defaultTtlSec * 1000 + 50);
		});

		it("doesn't update ttl when adding value which is already in cache", done => {
			const preciseMemSetCache = new PreciseMemSetCache();

			const value = 'value';
			preciseMemSetCache.add(value, 1);

			setTimeout(() => {
				preciseMemSetCache.add(value, 2);
			}, 500);

			setTimeout(() => {
				try {
					expect(preciseMemSetCache.has(value)).to.be.eq(false);
				} catch (e) {
					done(e);
				}
			}, 1050);

			setTimeout(() => {
				try {
					expect(preciseMemSetCache.has(value)).to.be.eq(false);
					done();
				} catch (e) {
					done(e);
				}
			}, 2550);
		}).timeout(2600);
	});

	describe('has spec', () => {
		it('lists all existing items at a given time point', done => {
			const preciseMemSetCache = new PreciseMemSetCache();

			const value1 = 'value1';
			const value2 = 'value2';
			const value3 = 'value3';

			preciseMemSetCache.add(value1);
			preciseMemSetCache.add(value2, 1);
			preciseMemSetCache.add(value3, 2);

			setTimeout(() => {
				try {
					expect(preciseMemSetCache.has(value1)).to.be.eq(true);
					expect(preciseMemSetCache.has(value2)).to.be.eq(true);
					expect(preciseMemSetCache.has(value3)).to.be.eq(true);
				} catch (e) {
					done(e);
				}
			}, 500);

			setTimeout(() => {
				try {
					expect(preciseMemSetCache.has(value1)).to.be.eq(true);
					expect(preciseMemSetCache.has(value2)).to.be.eq(false);
					expect(preciseMemSetCache.has(value3)).to.be.eq(true);
				} catch (e) {
					done(e);
				}
			}, 1050);

			setTimeout(() => {
				try {
					expect(preciseMemSetCache.has(value1)).to.be.eq(true);
					expect(preciseMemSetCache.has(value2)).to.be.eq(false);
					expect(preciseMemSetCache.has(value3)).to.be.eq(false);

					done();
				} catch (e) {
					done(e);
				}
			}, 2050);
		}).timeout(2100);
	});

	describe('delete spec', () => {
		it('delete is not allowed', done => {
			const preciseMemSetCache = new PreciseMemSetCache();

			try {
				preciseMemSetCache.delete('random');
				done(new Error('Delete should not be allowed'));
			} catch (e) {
				expect(e.code).to.be.eq(ErrorCodes.DELETE_NOT_ALLOWED);
				expect(e.message).to.be.eq(
					"Delete may cause undefined behaviour. Deleting a value will not delete it's timer. Adding the same value after deleting it, will use the old timer. "
				);
				done();
			}
		});
	});

	describe('upset spec', () => {
		it('upset adds a new entry if value not found', async () => {
			const preciseMemSetCache = new PreciseMemSetCache();

			const value = 'value';
			preciseMemSetCache.upset(value, 1);
			expect(preciseMemSetCache.has(value)).to.be.eq(true);

			await chrono.sleep(500);
			expect(preciseMemSetCache.has(value)).to.be.eq(true);

			await chrono.sleep(550);
			expect(preciseMemSetCache.has(value)).to.be.eq(false);
		});

		it('upset adds a new entry if value not found and restarts gc', async () => {
			const preciseMemSetCache = new PreciseMemSetCache();

			const value = 'value';

			async function doUpsetWithChecks() {
				preciseMemSetCache.upset(value, 1);
				expect(preciseMemSetCache.has(value)).to.be.eq(true);

				await chrono.sleep(500);
				expect(preciseMemSetCache.has(value)).to.be.eq(true);

				await chrono.sleep(550);
				expect(preciseMemSetCache.has(value)).to.be.eq(false);
			}

			await doUpsetWithChecks();
			// this should restart gc
			await doUpsetWithChecks();
		}).timeout(2200);

		it('upsets entry with new ttl', async () => {
			const preciseMemSetCache = new PreciseMemSetCache();

			let value = 'value4';
			preciseMemSetCache
				.add('value1')
				.add('value2')
				.add('value3', 5)
				.add(value);

			preciseMemSetCache.upset(value, 1);

			await chrono.sleep(100);
			expect(preciseMemSetCache.has(value)).to.be.eq(true);

			await chrono.sleep(950);
			expect(preciseMemSetCache.has(value)).to.be.eq(false);
			expect(preciseMemSetCache.size).to.be.eq(3);

			value = 'value3';
			preciseMemSetCache.upset(value, 1);

			await chrono.sleep(100);
			expect(preciseMemSetCache.has(value)).to.be.eq(true);

			await chrono.sleep(950);
			expect(preciseMemSetCache.has(value)).to.be.eq(false);
			expect(preciseMemSetCache.size).to.be.eq(2);
		}).timeout(2200);

		it("upset doesn't interfere with older timers", async () => {
			const preciseMemSetCache = new PreciseMemSetCache();

			preciseMemSetCache.upset('value', 5);
			preciseMemSetCache.upset('value', 1);

			await chrono.sleep(100);
			expect(preciseMemSetCache.has('value')).to.be.eq(true);
			await chrono.sleep(950);
			expect(preciseMemSetCache.has('value')).to.be.eq(false);

			preciseMemSetCache.upset('value', 1);
			preciseMemSetCache.upset('value', 2);

			await chrono.sleep(100);
			expect(preciseMemSetCache.has('value')).to.be.eq(true);
			await chrono.sleep(950);
			expect(preciseMemSetCache.has('value')).to.be.eq(true);
			await chrono.sleep(1050);
			expect(preciseMemSetCache.has('value')).to.be.eq(false);

			preciseMemSetCache.upset('value', 1);
			preciseMemSetCache.upset('value', 1);

			await chrono.sleep(100);
			expect(preciseMemSetCache.has('value')).to.be.eq(true);
			await chrono.sleep(950);
			expect(preciseMemSetCache.has('value')).to.be.eq(false);
		}).timeout(4500);

		it('upset restarts gc', async () => {
			const preciseMemSetCache = new PreciseMemSetCache();

			// restarts when there is no values
			preciseMemSetCache.upset('value', 1);
			await chrono.sleep(100);
			expect(preciseMemSetCache.has('value')).to.be.eq(true);
			await chrono.sleep(950);
			expect(preciseMemSetCache.has('value')).to.be.eq(false);

			// restarts when old replaced value had no ttl
			preciseMemSetCache.add('value');
			preciseMemSetCache.upset('value', 1);

			await chrono.sleep(100);
			expect(preciseMemSetCache.has('value')).to.be.eq(true);
			await chrono.sleep(950);
			expect(preciseMemSetCache.has('value')).to.be.eq(false);

			// restarts when old values had no ttl
			preciseMemSetCache.add('value0');
			preciseMemSetCache.add('value1');
			preciseMemSetCache.upset('value1', 1);

			await chrono.sleep(100);
			expect(preciseMemSetCache.has('value1')).to.be.eq(true);
			await chrono.sleep(950);
			expect(preciseMemSetCache.has('value0')).to.be.eq(true);
			expect(preciseMemSetCache.has('value1')).to.be.eq(false);

			// restarts after clear
			preciseMemSetCache.add('value', 1);
			preciseMemSetCache.add('value', 2);
			preciseMemSetCache.upset('value1', 1);
			preciseMemSetCache.upset('value2', 3);
			preciseMemSetCache.upset('value2', 2);

			preciseMemSetCache.clear();
			expect(preciseMemSetCache.size).to.be.eq(0);

			preciseMemSetCache.upset('value', 3);
			await chrono.sleep(1050);
			expect(preciseMemSetCache.has('value')).to.be.eq(true);
			expect(preciseMemSetCache.size).to.be.eq(1);
			await chrono.sleep(1050);
			expect(preciseMemSetCache.has('value')).to.be.eq(true);
			expect(preciseMemSetCache.size).to.be.eq(1);
			await chrono.sleep(1050);
			expect(preciseMemSetCache.has('value')).to.be.eq(false);
			expect(preciseMemSetCache.size).to.be.eq(0);
		}).timeout(6600);
	});

	describe('clear spec', () => {
		it('clears internal cache and gc tracked items on clear', done => {
			const preciseMemSetCache = new PreciseMemSetCache();

			const value = 'value';
			preciseMemSetCache.add(value, 1);

			setTimeout(() => {
				preciseMemSetCache.clear();
				preciseMemSetCache.add(value, 1);
			}, 500);

			setTimeout(() => {
				try {
					expect(preciseMemSetCache.has(value)).to.be.eq(true);
				} catch (e) {
					done(e);
				}
			}, 1050);

			setTimeout(() => {
				try {
					expect(preciseMemSetCache.has(value)).to.be.eq(false);
					done();
				} catch (e) {
					done(e);
				}
			}, 1550);
		});
	});
});

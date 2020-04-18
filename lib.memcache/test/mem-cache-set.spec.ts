import { describe, it } from 'mocha';
import { MemSetCache, INFINITE_TTL } from '../lib';
import { chai } from './chai';
import { ErrorCodes } from '../lib/error';

const { expect } = chai;

describe('MemSetCache spec', () => {
	it('creates mem cache set using default config', done => {
		const memSetCache = new MemSetCache();

		const value = 'value';
		memSetCache.add(value);

		setTimeout(() => {
			try {
				// by default, items have infinite ttl
				expect(memSetCache.has(value)).to.be.eq(true);
				done();
			} catch (e) {
				done(e);
			}
		}, 1000);
	});

	it('creates mem cache using explicit config', done => {
		const defaultTtlSec = 1;
		const memSetCache = new MemSetCache(defaultTtlSec);

		const value = 'value';
		memSetCache.add(value);

		setTimeout(() => {
			try {
				// by default, items have 1 sec ttl
				expect(memSetCache.has(value)).to.be.eq(false);
				done();
			} catch (e) {
				done(e);
			}
		}, defaultTtlSec * 1000 + 50);
	});

	it("does not remove items which don't have tll (i.e ttl provided as 0)", done => {
		const defaultTtlSec = 1;
		const memSetCache = new MemSetCache(defaultTtlSec);

		const value = 'value';
		memSetCache.add(value, INFINITE_TTL);

		setTimeout(() => {
			try {
				// explicit ttl has priority
				expect(memSetCache.has(value)).to.be.eq(true);
				done();
			} catch (e) {
				done(e);
			}
		}, defaultTtlSec * 1000 + 50);
	});

	it('lists all existing items at a given time point', done => {
		const memSetCache = new MemSetCache();

		const value1 = 'value1';
		const value2 = 'value2';
		const value3 = 'value3';

		memSetCache.add(value1);
		memSetCache.add(value2, 1);
		memSetCache.add(value3, 2);

		setTimeout(() => {
			try {
				expect(memSetCache.has(value1)).to.be.eq(true);
				expect(memSetCache.has(value2)).to.be.eq(true);
				expect(memSetCache.has(value3)).to.be.eq(true);
			} catch (e) {
				done(e);
			}
		}, 500);

		setTimeout(() => {
			try {
				expect(memSetCache.has(value1)).to.be.eq(true);
				expect(memSetCache.has(value2)).to.be.eq(false);
				expect(memSetCache.has(value3)).to.be.eq(true);
			} catch (e) {
				done(e);
			}
		}, 1050);

		setTimeout(() => {
			try {
				expect(memSetCache.has(value1)).to.be.eq(true);
				expect(memSetCache.has(value2)).to.be.eq(false);
				expect(memSetCache.has(value3)).to.be.eq(false);

				done();
			} catch (e) {
				done(e);
			}
		}, 2050);
	}).timeout(2100);

	it('delete is not allowed', done => {
		const memSetCache = new MemSetCache();

		try {
			memSetCache.delete('random');
			done(new Error('Delete should not be allowed'));
		} catch (e) {
			expect(e.code).to.be.eq(ErrorCodes.DELETE_NOT_ALLOWED);
			expect(e.message).to.be.eq(
				"Delete may cause undefined behaviour. Deleting a value will not delete it's timer. Adding the same value after deleting it, will use the old timer. "
			);
			done();
		}
	});

	it("doesn't update ttl when adding value which is already in cache", done => {
		const memSetCache = new MemSetCache();

		const value = 'value';
		memSetCache.add(value, 1);

		setTimeout(() => {
			memSetCache.add(value, 2);
		}, 500);

		setTimeout(() => {
			try {
				expect(memSetCache.has(value)).to.be.eq(false);
			} catch (e) {
				done(e);
			}
		}, 1050);

		setTimeout(() => {
			try {
				expect(memSetCache.has(value)).to.be.eq(false);
				done();
			} catch (e) {
				done(e);
			}
		}, 2550);
	}).timeout(2600);

	it('clears internal cache and gc tracked items on clear', done => {
		const memSetCache = new MemSetCache();

		const value = 'value';
		memSetCache.add(value, 1);

		setTimeout(() => {
			memSetCache.clear();
			memSetCache.add(value, 1);
		}, 500);

		setTimeout(() => {
			try {
				expect(memSetCache.has(value)).to.be.eq(true);
			} catch (e) {
				done(e);
			}
		}, 1050);

		setTimeout(() => {
			try {
				expect(memSetCache.has(value)).to.be.eq(false);
				done();
			} catch (e) {
				done(e);
			}
		}, 1550);
	});
});

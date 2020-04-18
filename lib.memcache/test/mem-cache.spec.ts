import { describe, it } from 'mocha';
import { chrono, array } from '@thermopylae/lib.utils';
import { INFINITE_TTL, MemCache } from '../lib';
import { chai } from './chai';

const nowInSeconds = chrono.dateToUNIX;
const { expect } = chai;

describe('MemCache spec', () => {
	it('creates mem cache using default config', done => {
		const memCache = new MemCache();
		const KEY = 'key';
		const VALUE = {
			level1: {
				level2: {
					level3: 'value'
				}
			}
		};
		memCache.set(KEY, VALUE);

		// check that infinite tll is used
		setTimeout(() => {
			// check that no deep copy was maked
			expect(memCache.get(KEY) === VALUE).to.be.equal(true);
			done();
		}, 1000);
	});

	it('creates mem cache using explicit config', done => {
		const memCache = new MemCache({ useClones: true, defaultTtlSec: 1 });
		const KEY = 'key';
		const VALUE = {
			level1: {
				level2: {
					level3: 'value'
				}
			}
		};
		memCache.set(KEY, VALUE);
		expect(memCache.get(KEY) === VALUE).to.be.equal(false);
		expect(memCache.get(KEY)).to.be.deep.equal(VALUE);

		// check that explicit tll is used
		setTimeout(() => {
			// check that no deep copy was maked
			expect(memCache.get(KEY)).to.be.equal(undefined);
			done();
		}, 1000);
	});

	it("does not remove items which don't have tll (i.e ttl provided as 0)", done => {
		const memCache = new MemCache({ defaultTtlSec: 1 });

		memCache.set('key', 'value', INFINITE_TTL);
		expect(memCache.get('key')).to.be.eq('value'); // get right after setting

		setTimeout(() => {
			expect(memCache.get('key')).to.be.eq('value');
			done();
		}, 1050);
	});

	it('returns multiple items', () => {
		const memCache = new MemCache();
		const items = [
			{ key: 'key1', value: 'value1' },
			{ key: 'key2', value: 'value2' }
		];
		memCache.mset(items);
		const itemsFromCache = memCache.mget(items.map(item => item.key).concat(['fake']));
		expect(itemsFromCache)
			.to.be.array()
			.ofSize(items.length);
		for (let i = 0; i < itemsFromCache.length; i += 1) {
			expect(itemsFromCache[i]).to.be.deep.equal(items[i]);
		}
	});

	it('lists all existing keys', () => {
		const memCache = new MemCache();
		const items = [
			{ key: 'key1', value: 'value1' },
			{ key: 'key2', value: 'value2' }
		];
		memCache.mset(items);
		expect(memCache.keys()).to.be.equalTo(items.map(item => item.key));
	});

	it('upsert adds a new entry if key not found', async () => {
		const memCache = new MemCache();
		memCache
			.set('key1', 'value1', 1)
			.set('key2', 'value2', 1)
			.set('key3', 'value3', 1);

		memCache.upset('key4', 'value4', 2);

		await chrono.sleep(1050);
		const keys = memCache.keys();
		expect(keys.length).to.be.eq(1);
		expect(keys[0]).to.be.eq('key4');

		await chrono.sleep(1050);
		expect(memCache.get('key4')).to.be.eq(undefined);
	}).timeout(2200);

	it('upsert updates entry if already exists', async () => {
		const memCache = new MemCache();
		memCache
			.set('key1', 'value1', 1)
			.set('key2', 'value2', 2)
			.set('key2.1', 'value2.1', 2)
			.set('key3', 'value3', 3);

		await chrono.sleep(1050);
		expect(memCache.keys()).to.be.equalTo(['key2', 'key2.1', 'key3']);

		memCache.upset('key3', 'value3.1', 1);
		expect(memCache.get('key3')).to.be.eq('value3.1');

		memCache.upset('key2.1', 'value2.2', 2);
		expect(memCache.get('key2.1')).to.be.eq('value2.2');

		await chrono.sleep(1050);
		expect(memCache.keys().length).to.be.eq(1);
		expect(memCache.get('key2.1')).to.be.eq('value2.2');

		await chrono.sleep(1050);
		expect(memCache.empty()).to.be.eq(true);
	}).timeout(3300);

	it('upsert fails to update entry setting new ttl to infinite', () => {
		const memCache = new MemCache();
		memCache.upset('key', 'val', 0);

		let err;
		try {
			memCache.upset('key', 'val', 0);
		} catch (e) {
			err = e;
		}

		expect(err).to.haveOwnProperty('message', 'UPDATING WITH INFINITE TTL IN NOT SUPPORTED YET');
	});

	it('returns positive answer when key is present in cache', () => {
		const memCache = new MemCache();
		const items = [
			{ key: 'key1', value: 'value1' },
			{ key: 'key2', value: 'value2' }
		];
		memCache.mset(items);
		expect(memCache.has(items[0].key)).to.be.equal(true);
		expect(memCache.has(items[1].key)).to.be.equal(true);
		expect(memCache.has('fake')).to.be.equal(false);
	});

	it('clears internal cache and gc tracked items on clear', done => {
		const memCache = new MemCache();
		const KEY = 'key';
		const VALUE = 'value';
		const TTL = 1;
		memCache.on('expired', () => done()); // should be emitted only once
		memCache.set(KEY, VALUE, TTL);
		memCache.clear(); // after this expired should not be emitted
		expect(memCache.get(KEY)).to.be.equal(undefined);
		memCache.set(KEY, VALUE, TTL); // now it will be emitted
	});

	it('fires set event when new item added to cache', done => {
		const memCache = new MemCache();
		const KEY = 'key';
		const VALUE = 'value';
		memCache.on('set', (key, value) => {
			expect(key === KEY).to.be.equal(true); // no copy
			expect(value).to.be.equal(VALUE);
			done();
		});
		memCache.set(KEY, VALUE);
	});

	it('fires set event when multiple items added to cache', done => {
		const memCache = new MemCache();
		const KEYS = ['key1', 'key2'];
		const VALUES = ['value1', 'value2'];
		memCache.on('set', (key, value) => {
			expect(KEYS).to.containing(key);
			expect(VALUES).to.contain(value);

			array.remove(KEYS, val => val === key);
			array.remove(VALUES, val => val === value);

			if (KEYS.length === 0 && VALUES.length === 0) {
				done();
			}
		});
		memCache.mset([
			{ key: KEYS[0], value: VALUES[0] },
			{ key: KEYS[1], value: VALUES[1] }
		]);
	});

	it('fires expired event when key expired', done => {
		const memCache = new MemCache();
		const KEY = 'key';
		const VALUE = 'value';
		const TTL = 1;
		memCache.set(KEY, VALUE, TTL);
		const whenKeyWasSet = nowInSeconds();
		memCache.on('expired', (key?: string) => {
			expect(key).to.be.equal(KEY);
			expect(nowInSeconds() - whenKeyWasSet).to.be.equal(TTL);
			done();
		});
	});

	it('fires clear event when cache was cleared', done => {
		const memCache = new MemCache();
		const KEY = 'key';
		const VALUE = 'value';
		const TTL = 1;
		memCache.set(KEY, VALUE, TTL);
		memCache.on('clear', () => {
			done();
		});
		memCache.clear();
	});

	it('does not emit event if handler was turner off (i.e removed)', done => {
		const memCache = new MemCache();
		const KEY = 'key';
		const VALUE = 'value';
		const setEventHandler = (): void => done(new Error('should not be called'));
		memCache.on('set', setEventHandler);
		memCache.off('set', setEventHandler);
		memCache.set(KEY, VALUE);
		done();
	});

	it('does not emit event if all handlers were removed', done => {
		const memCache = new MemCache();
		const KEY = 'key';
		const VALUE = 'value';
		const setEventHandler = (): void => done(new Error('should not be called'));
		memCache.on('set', setEventHandler);
		memCache.removeAllListeners('set');
		memCache.set(KEY, VALUE);
		done();
	});
});

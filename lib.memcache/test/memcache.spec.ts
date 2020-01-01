import { describe, it } from 'mocha';
import { chrono, misc } from '@marin/lib.utils';
import { MemCache } from '../lib';
import { chai } from './chai';

const { nowInSeconds } = chrono;
const { removeItemFromArray } = misc;
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
		const memCache = new MemCache({ useClones: true, stdTTL: 1 });
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
		const memCache = new MemCache();
		memCache.set('key', 'value', 0);
		expect(memCache.get('key')).to.be.eq('value'); // get right after setting
		setTimeout(() => {
			expect(memCache.get('key')).to.be.eq('value');
			done();
		}, 1000); // get after 1 sec
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
			expect(removeItemFromArray(key!, KEYS)).to.be.equal(true);
			expect(removeItemFromArray(value, VALUES)).to.be.equal(true);
			if (KEYS.length === 0 && VALUES.length === 0) {
				done();
			}
		});
		memCache.mset([
			{ key: KEYS[0], value: VALUES[0] },
			{ key: KEYS[1], value: VALUES[1] }
		]);
	});

	it('fires delete event when item was deleted explicitly from cache, without emitting expired event', done => {
		const memCache = new MemCache();
		const KEY = 'key';
		const VALUE = 'value';
		const TTL = 1;
		memCache.on('del', key => {
			expect(key === KEY).to.be.equal(true); // no copy
			done();
		});
		memCache.on('expired', () => {
			done(new Error('expired should not be emitted'));
		});
		memCache.set(KEY, VALUE, TTL);
		memCache.del(KEY);
	});

	it('fires delete event when multiple items were removed', done => {
		const memCache = new MemCache();
		const KEYS = ['key1', 'key2'];
		const VALUES = ['value1', 'value2'];
		memCache.on('del', key => {
			expect(KEYS).to.containing(key);
			expect(removeItemFromArray(key!, KEYS)).to.be.equal(true);
			if (KEYS.length === 0) {
				done();
			}
		});
		memCache.mset([
			{ key: KEYS[0], value: VALUES[0] },
			{ key: KEYS[1], value: VALUES[1] }
		]);
		expect(memCache.mdel(Array.from(KEYS))).to.be.equalTo([true, true]);
	});

	it('does not fire deleted event if item was not deleted successfully', done => {
		const memCache = new MemCache();
		const KEY = 'key';
		const VALUE = 'value';
		memCache.on('del', () => setTimeout(done, 100));
		memCache.set(KEY, VALUE);
		expect(memCache.del(KEY)).to.be.equal(true);
		expect(memCache.del(KEY)).to.be.equal(false);
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

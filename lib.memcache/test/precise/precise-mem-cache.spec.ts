import { describe, it } from 'mocha';
import { chrono, array } from '@thermopylae/lib.utils';
import { INFINITE_TTL, PreciseMemCache } from '../../lib';
import { cacheFactory, chai } from '../env';

const nowInSeconds = chrono.dateToUNIX;
const { expect } = chai;

describe('PreciseMemCache spec', () => {
	describe('constructor spec', () => {
		it('creates mem cache using default config', done => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache);
			const KEY = 'key';
			const VALUE = {
				level1: {
					level2: {
						level3: 'value'
					}
				}
			};
			preciseMemCache.set(KEY, VALUE);

			// check that infinite tll is used
			setTimeout(() => {
				// check that no deep copy was maked
				expect(preciseMemCache.get(KEY) === VALUE).to.be.equal(true);
				done();
			}, 1000);
		});

		it('creates mem cache using explicit config', done => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache, { useClones: true, defaultTtlSec: 1 });
			const KEY = 'key';
			const VALUE = {
				level1: {
					level2: {
						level3: 'value'
					}
				}
			};
			preciseMemCache.set(KEY, VALUE);
			expect(preciseMemCache.get(KEY) === VALUE).to.be.equal(false);
			expect(preciseMemCache.get(KEY)).to.be.deep.equal(VALUE);

			// check that explicit tll is used
			setTimeout(() => {
				// check that no deep copy was maked
				expect(preciseMemCache.get(KEY)).to.be.equal(undefined);
				done();
			}, 1000);
		});
	});

	describe('set spec', () => {
		it("does not remove items which don't have tll (i.e ttl provided as 0)", done => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache, { defaultTtlSec: 1 });

			preciseMemCache.set('key', 'value', INFINITE_TTL);
			expect(preciseMemCache.get('key')).to.be.eq('value'); // get right after setting

			setTimeout(() => {
				expect(preciseMemCache.get('key')).to.be.eq('value');
				done();
			}, 1050);
		});
	});

	describe('mset spec', () => {
		it('returns multiple items after mset', () => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache);
			const items = [
				{ key: 'key1', value: 'value1' },
				{ key: 'key2', value: 'value2' }
			];
			preciseMemCache.mset(items);
			const itemsFromCache = preciseMemCache.mget(items.map(item => item.key).concat(['fake']));
			expect(itemsFromCache)
				.to.be.array()
				.ofSize(items.length);
			for (let i = 0; i < itemsFromCache.length; i += 1) {
				expect(itemsFromCache[i]).to.be.deep.equal(items[i]);
			}
		});

		it('lists all existing keys after mset', () => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache);
			const items = [
				{ key: 'key1', value: 'value1' },
				{ key: 'key2', value: 'value2' }
			];
			preciseMemCache.mset(items);
			expect(preciseMemCache.keys()).to.be.equalTo(items.map(item => item.key));
		});
	});

	describe('upset spec', () => {
		it('upset adds a new entry if key not found', async () => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache);
			preciseMemCache
				.set('key1', 'value1', 1)
				.set('key2', 'value2', 1)
				.set('key3', 'value3', 1);

			preciseMemCache.upset('key4', 'value4', 2);

			await chrono.sleep(1050);
			const keys = preciseMemCache.keys();
			expect(keys.length).to.be.eq(1);
			expect(keys[0]).to.be.eq('key4');

			await chrono.sleep(1050);
			expect(preciseMemCache.get('key4')).to.be.eq(undefined);
		}).timeout(2200);

		it('upset updates entry if it already exists', async () => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache);
			preciseMemCache
				.set('key1', 'value1', 1)
				.set('key2', 'value2', 2)
				.set('key2.1', 'value2.1', 2)
				.set('key3', 'value3', 3);

			await chrono.sleep(1050);
			expect(preciseMemCache.keys()).to.be.equalTo(['key2', 'key2.1', 'key3']);

			preciseMemCache.upset('key3', 'value3.1', 1);
			expect(preciseMemCache.get('key3')).to.be.eq('value3.1');

			preciseMemCache.upset('key2.1', 'value2.2', 2);
			expect(preciseMemCache.get('key2.1')).to.be.eq('value2.2');

			await chrono.sleep(1050);
			expect(preciseMemCache.keys().length).to.be.eq(1);
			expect(preciseMemCache.get('key2.1')).to.be.eq('value2.2');

			await chrono.sleep(1050);
			expect(preciseMemCache.empty()).to.be.eq(true);
		}).timeout(3300);

		it("upset sets ttl for entry if it previously hadn't one", async () => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache);
			preciseMemCache
				.set('key1', 'value1')
				.set('key2', 'value2', 1)
				.set('key2.1', 'value2.1', 1)
				.set('key3', 'value3', 2);

			expect(preciseMemCache.keys().length).to.be.eq(4);

			await chrono.sleep(1050);
			expect(preciseMemCache.keys()).to.be.equalTo(['key1', 'key3']);

			preciseMemCache.upset('key1', 'value1.1', 1);

			await chrono.sleep(500);
			// keys still exists
			expect(preciseMemCache.get('key1')).to.be.eq('value1.1');
			expect(preciseMemCache.get('key3')).to.be.eq('value3');

			await chrono.sleep(550);
			expect(preciseMemCache.keys().length).to.be.eq(0);
		}).timeout(2200);

		it('upset will start gc if previous keys were inserted without ttl', async () => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache);
			preciseMemCache
				.set('key1', 'value1')
				.set('key2', 'value2')
				.set('key3', 'value3');

			expect(preciseMemCache.keys().length).to.be.eq(3);

			await chrono.sleep(1050);
			expect(preciseMemCache.keys().length).to.be.eq(3);

			preciseMemCache.upset('key1', 'value1.1', 1);
			await chrono.sleep(500);
			expect(preciseMemCache.get('key1')).to.be.eq('value1.1');

			await chrono.sleep(550);
			expect(preciseMemCache.keys()).to.be.equalTo(['key2', 'key3']);
		}).timeout(2200);

		it('upset will start gc when adding first key with ttl', async () => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache);
			preciseMemCache.upset('key1', 'value1', 1);

			await chrono.sleep(500);
			expect(preciseMemCache.get('key1')).to.be.eq('value1');

			await chrono.sleep(550);
			expect(preciseMemCache.keys()).to.be.equalTo([]);
		});

		it('upset will start gc after performing clear and adding first value with infinite ttl', async () => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache);
			preciseMemCache
				.set('key1', 'value1')
				.set('key2', 'value2', 1)
				.set('key2.1', 'value2.1', 1)
				.set('key3', 'value3', 2);

			expect(preciseMemCache.keys().length).to.be.eq(4);

			preciseMemCache.clear();
			expect(preciseMemCache.keys().length).to.be.eq(0);

			await chrono.sleep(1050);
			expect(preciseMemCache.keys().length).to.be.eq(0);

			preciseMemCache
				.upset('key1', 'value1')
				.upset('key2', 'value2')
				.upset('key3', 'value3')
				.upset('key4', 'value4');
			expect(preciseMemCache.keys().length).to.be.eq(4);

			await chrono.sleep(1050);
			expect(preciseMemCache.keys().length).to.be.eq(4);

			preciseMemCache.upset('key1', 'value1.1', 1);
			expect(preciseMemCache.get('key1')).to.be.eq('value1.1');

			await chrono.sleep(1050);
			expect(preciseMemCache.keys()).to.be.equalTo(['key2', 'key3', 'key4']);

			await chrono.sleep(1050);
			expect(preciseMemCache.keys()).to.be.equalTo(['key2', 'key3', 'key4']);
		}).timeout(4400);

		it("multiple upsets won't interfere with each other", async () => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache);
			let valueMinorVersionCounter = 0;

			preciseMemCache.upset('key1', `value1`);
			preciseMemCache.upset('key2', `value2`);
			preciseMemCache.upset('key3', `value3`);

			await chrono.sleep(100);
			expect(preciseMemCache.keys()).to.be.equalTo(['key1', 'key2', 'key3']);

			// eslint-disable-next-line no-plusplus
			preciseMemCache.upset('key1', `value1.${++valueMinorVersionCounter}`, valueMinorVersionCounter);
			// eslint-disable-next-line no-plusplus
			preciseMemCache.upset('key1', `value1.${++valueMinorVersionCounter}`, valueMinorVersionCounter);
			// eslint-disable-next-line no-plusplus
			preciseMemCache.upset('key1', `value1.${++valueMinorVersionCounter}`, valueMinorVersionCounter);
			// eslint-disable-next-line no-plusplus
			preciseMemCache.upset('key1', `value1.${++valueMinorVersionCounter}`, valueMinorVersionCounter);

			preciseMemCache.upset('key1', 'value1', 1);

			await chrono.sleep(1050);
			expect(preciseMemCache.keys()).to.be.equalTo(['key2', 'key3']);

			preciseMemCache.upset('key2', `value2.1`, 1);
			preciseMemCache.upset('key2', `value2.2`, 2);

			await chrono.sleep(1050);
			expect(preciseMemCache.keys()).to.be.equalTo(['key2', 'key3']);
			expect(preciseMemCache.get('key2')).to.be.eq('value2.2');

			await chrono.sleep(1050);
			expect(preciseMemCache.keys()).to.be.equalTo(['key3']);

			preciseMemCache.upset('key3', `value3.1`, 2);
			preciseMemCache.upset('key3', `value3.2`, 1);

			await chrono.sleep(100);
			expect(preciseMemCache.keys()).to.be.equalTo(['key3']);
			expect(preciseMemCache.get('key3')).to.be.eq('value3.2');

			await chrono.sleep(950);
			expect(preciseMemCache.keys()).to.be.equalTo([]);

			preciseMemCache.upset('key3', `value3.3`);

			await chrono.sleep(1050);
			// it doesn't interfere with previous 2 sec timer
			expect(preciseMemCache.get('key3')).to.be.eq('value3.3');

			preciseMemCache.upset('key3', `value3.4`, 1);

			// now cache is clear
			await chrono.sleep(100);
			expect(preciseMemCache.keys()).to.be.equalTo(['key3']);
			expect(preciseMemCache.get('key3')).to.be.eq('value3.4');

			await chrono.sleep(950);
			expect(preciseMemCache.keys()).to.be.equalTo([]);
		}).timeout(6500);

		it('upset at the same time with same values has no effect on timers', async () => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache);

			for (let i = 0; i < 10; i++) {
				preciseMemCache.upset('key', 'value', 1);
				expect(preciseMemCache.get('key')).to.be.eq('value');
				expect(preciseMemCache.size()).to.be.eq(1);
			}

			await chrono.sleep(1010);
			expect(preciseMemCache.empty()).to.be.eq(true);
		});

		it('upset fails to update entry setting new ttl to infinite', () => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache);
			preciseMemCache.upset('key', 'val', 0);

			let err;
			try {
				preciseMemCache.upset('key', 'val', 0);
			} catch (e) {
				err = e;
			}

			expect(err).to.haveOwnProperty('message', 'UPDATING WITH INFINITE TTL IN NOT SUPPORTED YET');
		});
	});

	describe('has spec', () => {
		it('returns positive answer when key is present in cache', () => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache);
			const items = [
				{ key: 'key1', value: 'value1' },
				{ key: 'key2', value: 'value2' }
			];
			preciseMemCache.mset(items);
			expect(preciseMemCache.has(items[0].key)).to.be.equal(true);
			expect(preciseMemCache.has(items[1].key)).to.be.equal(true);
			expect(preciseMemCache.has('fake')).to.be.equal(false);
		});
	});

	describe('clear spec', () => {
		it('clears internal cache and gc tracked items on clear', done => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache);
			const KEY = 'key';
			const VALUE = 'value';
			const TTL = 1;
			preciseMemCache.on('expired', () => done()); // should be emitted only once
			preciseMemCache.set(KEY, VALUE, TTL);
			preciseMemCache.clear(); // after this expired should not be emitted
			expect(preciseMemCache.get(KEY)).to.be.equal(undefined);
			preciseMemCache.set(KEY, VALUE, TTL); // now it will be emitted
		});
	});

	describe('events spec', () => {
		it('fires set event when new item added to cache', done => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache, { defaultTtlSec: INFINITE_TTL });
			const KEY = 'key';
			const VALUE = 'value';
			preciseMemCache.on('set', (key, value) => {
				expect(key === KEY).to.be.equal(true); // no copy
				expect(value).to.be.equal(VALUE);
				done();
			});
			preciseMemCache.set(KEY, VALUE);
		});

		it('fires set event when multiple items added to cache', done => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache, { defaultTtlSec: INFINITE_TTL });
			const KEYS = ['key1', 'key2'];
			const VALUES = ['value1', 'value2'];
			preciseMemCache.on('set', (key, value) => {
				expect(KEYS).to.containing(key);
				expect(VALUES).to.contain(value);

				array.remove(KEYS, val => val === key);
				array.remove(VALUES, val => val === value);

				if (KEYS.length === 0 && VALUES.length === 0) {
					done();
				}
			});
			preciseMemCache.mset([
				{ key: KEYS[0], value: VALUES[0] },
				{ key: KEYS[1], value: VALUES[1] }
			]);
		});

		it("fires update event when value is updated, but ttl don't", done => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache, { defaultTtlSec: INFINITE_TTL });

			preciseMemCache.on('update', (key, value, ttlSec) => {
				try {
					expect(key).to.be.eq('key1');
					expect(value).to.be.eq('value1.1');
					expect(ttlSec).to.be.eq(1);

					done();
				} catch (e) {
					done(e);
				}
			});

			preciseMemCache
				.upset('key1', 'value1')
				.upset('key2', 'value2')
				.upset('key1', 'value1.1', 1);
		});

		it('fires update/set events when value and ttl for key is added/updated', done => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache, { defaultTtlSec: INFINITE_TTL });

			let setFiredNo = 0;
			let updateFiredNo = 0;
			let expiredFiredNo = 0;

			preciseMemCache.on('set', (key, value, ttlSec) => {
				try {
					setFiredNo += 1;

					expect(['key1', 'key2']).to.containing(key);
					expect(['value1', 'value2']).to.containing(value);
					expect(ttlSec).to.be.eq(0);
				} catch (e) {
					done(e);
				}
			});

			preciseMemCache.on('update', (key, value, ttlSec) => {
				try {
					updateFiredNo += 1;

					expect(key).to.be.eq('key1');
					expect(value).to.be.eq('value1.1');
					expect(ttlSec).to.be.eq(1);
				} catch (e) {
					done(e);
				}
			});

			preciseMemCache.on('expired', (key, value, ttlSec) => {
				try {
					expiredFiredNo += 1;

					expect(key).to.be.eq('key1');
					expect(value).to.be.eq(undefined);
					expect(ttlSec).to.be.eq(undefined);

					expect(setFiredNo).to.be.eq(2);
					expect(updateFiredNo).to.be.eq(1);
					expect(expiredFiredNo).to.be.eq(1);

					done();
				} catch (e) {
					done(e);
				}
			});

			preciseMemCache
				.upset('key1', 'value1')
				.upset('key2', 'value2')
				.upset('key1', 'value1.1', 1);
		});

		it('fires expired event when key expired', done => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache, { defaultTtlSec: INFINITE_TTL });
			const KEY = 'key';
			const VALUE = 'value';
			const TTL = 1;
			preciseMemCache.set(KEY, VALUE, TTL);
			const whenKeyWasSet = nowInSeconds();
			preciseMemCache.on('expired', (key?: string) => {
				expect(key).to.be.equal(KEY);
				expect(nowInSeconds() - whenKeyWasSet).to.be.equal(TTL);
				done();
			});
		});

		it('fires clear event when cache was cleared', done => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache, { defaultTtlSec: INFINITE_TTL });
			const KEY = 'key';
			const VALUE = 'value';
			const TTL = 1;
			preciseMemCache.set(KEY, VALUE, TTL);
			preciseMemCache.on('clear', () => {
				done();
			});
			preciseMemCache.clear();
		});

		it('does not emit event if handler was turner off (i.e removed)', done => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache, { defaultTtlSec: INFINITE_TTL });
			const KEY = 'key';
			const VALUE = 'value';
			const setEventHandler = (): void => done(new Error('should not be called'));
			preciseMemCache.on('set', setEventHandler);
			preciseMemCache.off('set', setEventHandler);
			preciseMemCache.set(KEY, VALUE);
			done();
		});

		it('does not emit event if all handlers were removed', done => {
			const preciseMemCache = cacheFactory<PreciseMemCache>(PreciseMemCache, { defaultTtlSec: INFINITE_TTL });
			const KEY = 'key';
			const VALUE = 'value';
			const setEventHandler = (): void => done(new Error('should not be called'));
			preciseMemCache.on('set', setEventHandler);
			preciseMemCache.removeAllListeners('set');
			preciseMemCache.set(KEY, VALUE);
			done();
		});
	});
});

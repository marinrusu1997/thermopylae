import { array, chrono, number } from '@thermopylae/lib.utils';
import { expect } from '@thermopylae/lib.unit-test';
import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { describe, it } from 'mocha';
import colors from 'colors';
import { ExpirableCacheKeyEntry, ProactiveExpirationPolicy } from '../../../lib/policies/expiration/proactive';
import { EXPIRES_AT_SYM } from '../../../lib/policies/expiration/abstract';
import { Deleter, SetOperationContext } from '../../../lib/contracts/replacement-policy';

function generateEntry<K>(key: K): ExpirableCacheKeyEntry<K, any> {
	return {
		key,
		value: array.randomElement(generateEntry.VALUES),
		[EXPIRES_AT_SYM]: 0
	};
}
generateEntry.VALUES = [undefined, null, false, 0, '', {}, []];

function generateSetContext(expiresAfter: Seconds, expiresFrom?: UnixTimestamp): SetOperationContext {
	return { totalEntriesNo: 0, expiresAfter, expiresFrom };
}

describe(`${colors.magenta(ProactiveExpirationPolicy.name)} spec`, () => {
	const defaultTTL = 1; // second

	it('removes expired item', (done) => {
		const expirationPolicy = new ProactiveExpirationPolicy<string, any>();

		const trackedKey = 'key';
		const whenTrackingBegan = chrono.unixTime();

		const deleter: Deleter<string> = (key) => {
			expect(chrono.unixTime() - whenTrackingBegan).to.be.equals(defaultTTL);
			expect(key).to.be.equals(trackedKey);

			// internal structure will be clean up after deleter is invoked
			expect(expirationPolicy.size).to.be.eq(1);
			process.nextTick(() => {
				expect(expirationPolicy.size).to.be.eq(0);
				done();
			});
		};

		expirationPolicy.setDeleter(deleter);
		expirationPolicy.onSet(trackedKey, generateEntry(trackedKey), { totalEntriesNo: 1, expiresAfter: defaultTTL });
	});

	it('removes multiple expired keys with same ttl (tracking started at same time)', (done) => {
		const expirationPolicy = new ProactiveExpirationPolicy<string, any>();

		const trackedKeys = ['key1', 'key2', 'key3'];
		const whenTrackingBegan = chrono.unixTime();

		const deleter: Deleter<string> = (key) => {
			expect(chrono.unixTime() - whenTrackingBegan).to.be.equals(defaultTTL);
			expect(trackedKeys).to.be.containing(key);
			trackedKeys.splice(trackedKeys.indexOf(key), 1); // ensure not called with same key

			if (trackedKeys.length === 0) {
				process.nextTick(() => {
					expect(expirationPolicy.size).to.be.eq(0);
					done();
				});
			}
		};

		expirationPolicy.setDeleter(deleter);
		trackedKeys.forEach((key) => expirationPolicy.onSet(key, generateEntry(key), generateSetContext(defaultTTL)));
	});

	it('removes multiple expired keys with different ttl (tracking started at same time)', (done) => {
		const expirationPolicy = new ProactiveExpirationPolicy<string, any>();

		const trackedKeysMap = new Map<string, number>();
		trackedKeysMap.set('key1', defaultTTL);
		trackedKeysMap.set('key2', defaultTTL);
		trackedKeysMap.set('key3', defaultTTL + 1);
		trackedKeysMap.set('key4', defaultTTL + 1);

		const whenTrackingBegan = chrono.unixTime();
		const deleter: Deleter<string> = (key) => {
			expect(chrono.unixTime() - whenTrackingBegan).to.be.equals(trackedKeysMap.get(key));
			expect(Array.from(trackedKeysMap.keys())).to.be.containing(key);
			trackedKeysMap.delete(key); // ensure not called with same key

			if (trackedKeysMap.size === 0) {
				done();
			}
		};

		expirationPolicy.setDeleter(deleter);
		trackedKeysMap.forEach((ttl, key) => expirationPolicy.onSet(key, generateEntry(key), generateSetContext(ttl)));
	}).timeout(2100);

	it('removes multiple expired keys with different ttl in the order keys were tracked (tracking stared at different times)', (done) => {
		const expirationPolicy = new ProactiveExpirationPolicy<string, any>();
		const KEYS_TO_BE_TRACKED = 4;

		const trackedKeysMap = new Map<string, { trackingSince: number; ttl: number }>();
		const trackedKeysSnapshot = ['key1', 'key2', 'key3', 'key4'];

		let currentNumberOfRemovedKeys = 0;

		expirationPolicy.setDeleter((key) => {
			const trackingInfo = trackedKeysMap.get(key);

			expect(chrono.unixTime() - trackingInfo!.trackingSince).to.be.equals(trackingInfo!.ttl);
			expect(Array.from(trackedKeysMap.keys())).to.be.containing(key);

			trackedKeysMap.delete(key); // ensure not called with same key

			expect(trackedKeysSnapshot[currentNumberOfRemovedKeys]).to.be.equal(key);

			currentNumberOfRemovedKeys += 1;
			if (currentNumberOfRemovedKeys === KEYS_TO_BE_TRACKED) {
				done();
			}
		});

		trackedKeysMap.set('key1', { trackingSince: chrono.unixTime(), ttl: defaultTTL });
		expirationPolicy.onSet('key1', generateEntry('key1'), generateSetContext(defaultTTL));

		setTimeout(() => {
			trackedKeysMap.set('key2', { trackingSince: chrono.unixTime(), ttl: defaultTTL });
			expirationPolicy.onSet('key2', generateEntry('key2'), generateSetContext(defaultTTL));
		}, 1000);

		setTimeout(() => {
			trackedKeysMap.set('key3', { trackingSince: chrono.unixTime(), ttl: defaultTTL });
			expirationPolicy.onSet('key3', generateEntry('key3'), generateSetContext(defaultTTL));
		}, 2000);

		setTimeout(() => {
			trackedKeysMap.set('key4', { trackingSince: chrono.unixTime(), ttl: defaultTTL });
			expirationPolicy.onSet('key4', generateEntry('key4'), generateSetContext(defaultTTL));
		}, 3000);
	}).timeout(4100);

	it('removes duplicate keys with same ttl', (done) => {
		const expirationPolicy = new ProactiveExpirationPolicy<string, any>();

		const trackedKeys = ['key', 'key', 'key'];
		const whenTrackingBegan = chrono.unixTime();

		expirationPolicy.setDeleter((key) => {
			expect(chrono.unixTime() - whenTrackingBegan!).to.be.equals(defaultTTL);
			expect(trackedKeys).to.be.containing(key);

			trackedKeys.splice(trackedKeys.indexOf(key), 1); // ensure not called with same key
			if (trackedKeys.length === 0) {
				done();
			}
		});
		trackedKeys.forEach((key) => expirationPolicy.onSet(key, generateEntry(key), generateSetContext(defaultTTL)));
	});

	it('restarts expirationPolicy after all tracked keys were removed (new key tracked from scheduleDeletion handler)', (done) => {
		const expirationPolicy = new ProactiveExpirationPolicy<string, any>();

		const trackedKeys = ['key1', 'key2'];
		const MAX_TRACKED_KEY_RECURSION_DEPTH = 2;
		let currentNumberOfTrackedKeys = 0;

		let whenTrackingBegan: number | undefined;

		const trackKey = (key: string): void => {
			expirationPolicy.onSet(key, generateEntry(key), generateSetContext(defaultTTL));
			whenTrackingBegan = chrono.unixTime();
			currentNumberOfTrackedKeys += 1;
		};

		expirationPolicy.setDeleter((key) => {
			expect(chrono.unixTime() - whenTrackingBegan!).to.be.equals(defaultTTL);
			expect(trackedKeys).to.be.containing(key);
			trackedKeys.splice(trackedKeys.indexOf(key), 1); // ensure not called with same key
			if (currentNumberOfTrackedKeys === MAX_TRACKED_KEY_RECURSION_DEPTH) {
				done();
			} else {
				trackKey('key2');
			}
		});

		trackKey('key1');
	}).timeout(2100);

	it('restarts expirationPolicy after all tracked keys were removed (new key tracked using setTimeout)', (done) => {
		const expirationPolicy = new ProactiveExpirationPolicy<string, any>();

		const trackedKeys = ['key1', 'key2'];
		let whenTrackingBegan: number | undefined;

		const trackKey = (key: string): void => {
			expirationPolicy.onSet(key, generateEntry(key), generateSetContext(defaultTTL));
			whenTrackingBegan = chrono.unixTime();
		};

		expirationPolicy.setDeleter((key) => {
			expect(chrono.unixTime() - whenTrackingBegan!).to.be.equals(defaultTTL);
			expect(trackedKeys).to.be.containing(key);
			trackedKeys.splice(trackedKeys.indexOf(key), 1); // ensure not called with same key
			if (trackedKeys.length === 0) {
				done();
			}
		});

		trackKey('key1');

		setTimeout(() => trackKey('key2'), (defaultTTL + 1.5) * 1000);
	}).timeout(3600);

	it('restarts the expirationPolicy after it was stopped, discarding and its internal list of tracked keys', (done) => {
		const expirationPolicy = new ProactiveExpirationPolicy<string, number>();

		const trackedKeyBeforeStopping = 'key1';
		const trackedKeyAfterStopping = 'key2';
		let whenTrackingBegan: number | undefined;

		const trackKey = (key: string): void => {
			expirationPolicy.onSet(key, generateEntry(key), generateSetContext(defaultTTL));
			whenTrackingBegan = chrono.unixTime();
		};

		expirationPolicy.setDeleter((key) => {
			expect(chrono.unixTime() - whenTrackingBegan!).to.be.equals(defaultTTL);
			expect(trackedKeyAfterStopping).to.be.equal(key);
			done();
		});

		trackKey(trackedKeyBeforeStopping);
		expirationPolicy.onClear();
		setTimeout(() => trackKey(trackedKeyAfterStopping), 1500);
	}).timeout(2600);

	it('expirationPolicy is synchronized with nearest element to remove while adding keys', async () => {
		const expirationPolicy = new ProactiveExpirationPolicy<string, any>();
		const keys = new Set<string>();

		expirationPolicy.setDeleter((key) => keys.delete(key));
		expect(expirationPolicy.isIdle()).to.be.eq(true);

		// adding element with same ttl
		keys.add('key1');
		expirationPolicy.onSet('key1', generateEntry('key1'), generateSetContext(1));
		expect(expirationPolicy.isIdle()).to.be.eq(false);

		await chrono.sleep(50);
		keys.add('key2');
		expirationPolicy.onSet('key2', generateEntry('key2'), generateSetContext(1));

		await chrono.sleep(1010);
		expect(keys.size).to.be.eq(0);
		expect(expirationPolicy.size).to.be.eq(0);
		expect(expirationPolicy.isIdle()).to.be.eq(true);

		// adding element with greater ttl
		keys.add('key1');
		expirationPolicy.onSet('key1', generateEntry('key1'), generateSetContext(1));
		expect(expirationPolicy.isIdle()).to.be.eq(false);

		await chrono.sleep(50);
		keys.add('key2');
		expirationPolicy.onSet('key2', generateEntry('key2'), generateSetContext(2));

		await chrono.sleep(1010);
		expect(keys.size).to.be.eq(1);
		expect(expirationPolicy.size).to.be.eq(1);
		expect(keys.has('key1')).to.be.eq(false);
		expect(expirationPolicy.isIdle()).to.be.eq(false);

		await chrono.sleep(1010);
		expect(keys.size).to.be.eq(0);
		expect(expirationPolicy.size).to.be.eq(0);
		expect(expirationPolicy.isIdle()).to.be.eq(true);

		// adding element smaller
		keys.add('key1');
		expirationPolicy.onSet('key1', generateEntry('key1'), generateSetContext(2));
		expect(expirationPolicy.isIdle()).to.be.eq(false);

		await chrono.sleep(50);
		keys.add('key2');
		expirationPolicy.onSet('key2', generateEntry('key2'), generateSetContext(1));

		await chrono.sleep(1010);
		expect(keys.size).to.be.eq(1);
		expect(expirationPolicy.size).to.be.eq(1);
		expect(keys.has('key2')).to.be.eq(false);
		expect(expirationPolicy.isIdle()).to.be.eq(false);

		await chrono.sleep(1010);
		expect(keys.size).to.be.eq(0);
		expect(expirationPolicy.size).to.be.eq(0);
		expect(expirationPolicy.isIdle()).to.be.eq(true);
	}).timeout(6000);

	it('expirationPolicy is synchronized with nearest element to remove while adding/updating keys', (done) => {
		const expirationPolicy = new ProactiveExpirationPolicy<string, any>();
		const keys = new Set<string>();
		expirationPolicy.setDeleter((key) => keys.delete(key));
		expect(expirationPolicy.isIdle()).to.be.eq(true);

		const MIN_TTL = 1;
		const MAX_TTL = 5;

		const ITEM_MIN_RANGE = 1;
		const ITEM_MAX_RANGE = 100;

		const SCHEDULING_TIMES = 500;

		const SCHEDULE_DELETION_MIN_DELAY = 0;
		const SCHEDULE_DELETION_MAX_DELAY = 4;

		const CHECK_INTERVAL_MIN = MIN_TTL;
		const CHECK_INTERVAL_MAX = MAX_TTL * 2;

		const keysDeletionDelay = new Map<string, number>();

		for (let checkIntervalNo = CHECK_INTERVAL_MIN; checkIntervalNo <= CHECK_INTERVAL_MAX; checkIntervalNo++) {
			// eslint-disable-next-line no-loop-func
			setTimeout(() => {
				keysDeletionDelay.forEach((deleteAtIntervalNo, key) => {
					if (deleteAtIntervalNo === checkIntervalNo) {
						try {
							expect(keys.has(key)).to.be.eq(false);
							expect(expirationPolicy.isIdle()).to.be.eq(keys.size === 0);
						} catch (e) {
							done(e);
						}
					}
				});

				if (checkIntervalNo === CHECK_INTERVAL_MAX) {
					if (keys.size !== 0) {
						return done(new Error(`${keys.size} remained at the ${checkIntervalNo} check interval, expected 0`));
					}

					try {
						expect(expirationPolicy.isIdle()).to.be.eq(true);
						keysDeletionDelay.clear();
						return done();
					} catch (e) {
						return done(e);
					}
				}

				return undefined;
			}, checkIntervalNo * 1000 + 30);
		}

		const gcIntervalReTrackSchedulers = new Map<number, Array<() => void>>();

		for (let i = SCHEDULE_DELETION_MIN_DELAY; i <= SCHEDULE_DELETION_MAX_DELAY; i++) {
			gcIntervalReTrackSchedulers.set(i, []);
			setTimeout(() => {
				gcIntervalReTrackSchedulers.get(i)!.forEach((scheduleDeletion) => scheduleDeletion());
				gcIntervalReTrackSchedulers.delete(i);
			}, i * 1000);
		}

		for (let i = 0; i < SCHEDULING_TIMES; i++) {
			const scheduleDeletionDelay = number.randomInt(SCHEDULE_DELETION_MIN_DELAY, SCHEDULE_DELETION_MAX_DELAY);

			gcIntervalReTrackSchedulers.get(scheduleDeletionDelay)!.push(() => {
				const key = `key${number.randomInt(ITEM_MIN_RANGE, ITEM_MAX_RANGE)}`;
				const ttl = number.randomInt(MIN_TTL, MAX_TTL);

				keysDeletionDelay.set(key, ttl + scheduleDeletionDelay);

				keys.add(key);
				expirationPolicy.onUpdate(key, generateEntry(key), generateSetContext(ttl));
			});
		}
	}).timeout(10_500);
});

import { chrono, number } from '@thermopylae/lib.utils';
import { describe, it } from 'mocha';
import { chai } from '../env';
import { AutoExpirationPolicy } from '../../lib/expiration-policies/auto-expiration-policy';

const nowInSeconds = chrono.dateToUNIX;
const { expect } = chai;

describe('High Resolution Expiration CachePolicy spec', () => {
	const defaultTTL = 1; // second

	it('removes isExpired item', done => {
		const trackedKey = 'key';
		const whenTrackingBegan = nowInSeconds();
		const expirationPolicy = new AutoExpirationPolicy();
		expirationPolicy.setDeleter(key => {
			expect(nowInSeconds() - whenTrackingBegan).to.be.equals(defaultTTL);
			expect(key).to.be.equals(trackedKey);
			done();
		});

		expirationPolicy.onSet(trackedKey, defaultTTL);
	});

	it('removes multiple isExpired keys with same ttl (tracking started at same time)', done => {
		const trackedKeys = ['key1', 'key2', 'key3'];
		const whenTrackingBegan = nowInSeconds();
		const expirationPolicy = new AutoExpirationPolicy();
		expirationPolicy.setDeleter(key => {
			expect(nowInSeconds() - whenTrackingBegan).to.be.equals(defaultTTL);
			expect(trackedKeys).to.be.containing(key);
			trackedKeys.splice(trackedKeys.indexOf(key), 1); // ensure not called with same key
			if (trackedKeys.length === 0) {
				done();
			}
		});
		trackedKeys.forEach(key => expirationPolicy.onSet(key, defaultTTL));
	});

	it('removes multiple isExpired keys with different ttl (tracking started at same time)', done => {
		const trackedKeysMap = new Map<string, number>();
		trackedKeysMap.set('key1', defaultTTL);
		trackedKeysMap.set('key2', defaultTTL);
		trackedKeysMap.set('key3', defaultTTL + 1);
		trackedKeysMap.set('key4', defaultTTL + 1);
		const whenTrackingBegan = nowInSeconds();
		const expirationPolicy = new AutoExpirationPolicy();
		expirationPolicy.setDeleter(key => {
			expect(nowInSeconds() - whenTrackingBegan).to.be.equals(trackedKeysMap.get(key));
			expect(Array.from(trackedKeysMap.keys())).to.be.containing(key);
			trackedKeysMap.delete(key); // ensure not called with same key
			if (trackedKeysMap.size === 0) {
				done();
			}
		});
		trackedKeysMap.forEach((ttl, key) => expirationPolicy.onSet(key, ttl));
	}).timeout(2100);

	it('removes multiple isExpired keys with different ttl in the order keys were tracked (tracking stared at different times)', done => {
		const trackedKeysMap = new Map<string, { trackingSince: number; ttl: number }>();
		const KEYS_TO_BE_TRACKED = 4;
		let currentNumberOfRemovedKeys = 0;
		const trackedKeysSnapshot = ['key1', 'key2', 'key3', 'key4'];
		const expirationPolicy = new AutoExpirationPolicy();
		expirationPolicy.setDeleter(key => {
			const value = trackedKeysMap.get(key);
			expect(nowInSeconds() - value!.trackingSince).to.be.equals(value!.ttl);
			expect(Array.from(trackedKeysMap.keys())).to.be.containing(key);
			trackedKeysMap.delete(key); // ensure not called with same key
			expect(trackedKeysSnapshot[currentNumberOfRemovedKeys]).to.be.equal(key);
			currentNumberOfRemovedKeys += 1;
			if (currentNumberOfRemovedKeys === KEYS_TO_BE_TRACKED) {
				done();
			}
		});

		trackedKeysMap.set('key1', { trackingSince: nowInSeconds(), ttl: defaultTTL });
		expirationPolicy.onSet('key1', defaultTTL);

		setTimeout(() => {
			trackedKeysMap.set('key2', { trackingSince: nowInSeconds(), ttl: defaultTTL });
			expirationPolicy.onSet('key2', defaultTTL);
		}, 1000);

		setTimeout(() => {
			trackedKeysMap.set('key3', { trackingSince: nowInSeconds(), ttl: defaultTTL });
			expirationPolicy.onSet('key3', defaultTTL);
		}, 2000);

		setTimeout(() => {
			trackedKeysMap.set('key4', { trackingSince: nowInSeconds(), ttl: defaultTTL });
			expirationPolicy.onSet('key4', defaultTTL);
		}, 3000);
	}).timeout(4100);

	it('removes duplicate keys with same ttl', done => {
		const trackedKeys = ['key', 'key', 'key'];
		const whenTrackingBegan = nowInSeconds();
		const expirationPolicy = new AutoExpirationPolicy();
		expirationPolicy.setDeleter(key => {
			expect(nowInSeconds() - whenTrackingBegan!).to.be.equals(defaultTTL);
			expect(trackedKeys).to.be.containing(key);
			trackedKeys.splice(trackedKeys.indexOf(key), 1); // ensure not called with same key
			if (trackedKeys.length === 0) {
				done();
			}
		});
		trackedKeys.forEach(key => expirationPolicy.onSet(key, defaultTTL));
	});

	it('restarts expirationPolicy after all tracked keys were removed (new key tracked from scheduleDeletion handler)', done => {
		const trackedKeys = ['key1', 'key2'];
		const MAX_TRACKED_KEY_RECURSION_DEPTH = 2;
		let currentNumberOfTrackedKeys = 0;

		let whenTrackingBegan: number | undefined;

		const trackKey = (key: string): void => {
			expirationPolicy.onSet(key, defaultTTL);
			whenTrackingBegan = nowInSeconds();
			currentNumberOfTrackedKeys += 1;
		};

		const expirationPolicy = new AutoExpirationPolicy();
		expirationPolicy.setDeleter(key => {
			expect(nowInSeconds() - whenTrackingBegan!).to.be.equals(defaultTTL);
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

	it('restarts expirationPolicy after all tracked keys were removed (new key tracked using setTimeout)', done => {
		const trackedKeys = ['key1', 'key2'];
		let whenTrackingBegan: number | undefined;

		const trackKey = (key: string): void => {
			expirationPolicy.onSet(key, defaultTTL);
			whenTrackingBegan = nowInSeconds();
		};

		const expirationPolicy = new AutoExpirationPolicy();
		expirationPolicy.setDeleter(key => {
			expect(nowInSeconds() - whenTrackingBegan!).to.be.equals(defaultTTL);
			expect(trackedKeys).to.be.containing(key);
			trackedKeys.splice(trackedKeys.indexOf(key), 1); // ensure not called with same key
			if (trackedKeys.length === 0) {
				done();
			}
		});

		trackKey('key1');

		setTimeout(() => trackKey('key2'), (defaultTTL + 1.5) * 1000);
	}).timeout(3600);

	it('restarts the expirationPolicy after it was stopped, discarding and its internal list of tracked keys', done => {
		const trackedKeyBeforeStopping = 'key1';
		const trackedKeyAfterStopping = 'key2';
		let whenTrackingBegan: number | undefined;

		const trackKey = (key: string): void => {
			expirationPolicy.onSet(key, defaultTTL);
			whenTrackingBegan = nowInSeconds();
		};

		const expirationPolicy = new AutoExpirationPolicy();
		expirationPolicy.setDeleter(key => {
			expect(nowInSeconds() - whenTrackingBegan!).to.be.equals(defaultTTL);
			expect(trackedKeyAfterStopping).to.be.equal(key);
			done();
		});

		trackKey(trackedKeyBeforeStopping);
		expirationPolicy.onClear();
		setTimeout(() => trackKey(trackedKeyAfterStopping), 1500);
	}).timeout(2600);

	it('expirationPolicy is synchronized with nearest element to remove while adding keys', async () => {
		const items = new Set();
		const expirationPolicy = new AutoExpirationPolicy();
		expirationPolicy.setDeleter(item => items.delete(item));
		expect(expirationPolicy.isIdle()).to.be.eq(true);

		// adding element with same ttl
		items.add('value1');
		expirationPolicy.onSet('value1', 1);
		expect(expirationPolicy.isIdle()).to.be.eq(false);

		await chrono.sleep(50);
		items.add('value2');
		expirationPolicy.onSet('value2', 1);

		await chrono.sleep(1010);
		expect(items.size).to.be.eq(0);
		expect(expirationPolicy.isIdle()).to.be.eq(true);

		// adding element with greater ttl
		items.add('value1');
		expirationPolicy.onSet('value1', 1);
		expect(expirationPolicy.isIdle()).to.be.eq(false);

		await chrono.sleep(50);
		items.add('value2');
		expirationPolicy.onSet('value2', 2);

		await chrono.sleep(1010);
		expect(items.size).to.be.eq(1);
		expect(items.has('value1')).to.be.eq(false);
		expect(expirationPolicy.isIdle()).to.be.eq(false);

		await chrono.sleep(1010);
		expect(items.size).to.be.eq(0);
		expect(expirationPolicy.isIdle()).to.be.eq(true);

		// adding element smaller
		items.add('value1');
		expirationPolicy.onSet('value1', 2);
		expect(expirationPolicy.isIdle()).to.be.eq(false);

		await chrono.sleep(50);
		items.add('value2');
		expirationPolicy.onSet('value2', 1);

		await chrono.sleep(1010);
		expect(items.size).to.be.eq(1);
		expect(items.has('value2')).to.be.eq(false);
		expect(expirationPolicy.isIdle()).to.be.eq(false);

		await chrono.sleep(1010);
		expect(items.size).to.be.eq(0);
		expect(expirationPolicy.isIdle()).to.be.eq(true);
	}).timeout(6000);

	it('expirationPolicy is synchronized with nearest element to remove while adding/updating keys', done => {
		const items = new Set();
		const expirationPolicy = new AutoExpirationPolicy();
		expirationPolicy.setDeleter(item => items.delete(item));
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

		const itemsDeletionDelay = new Map<string, number>();

		for (let checkIntervalNo = CHECK_INTERVAL_MIN; checkIntervalNo <= CHECK_INTERVAL_MAX; checkIntervalNo++) {
			// eslint-disable-next-line no-loop-func
			setTimeout(() => {
				itemsDeletionDelay.forEach((deleteAtIntervalNo, item) => {
					if (deleteAtIntervalNo === checkIntervalNo) {
						try {
							expect(items.has(item)).to.be.eq(false);
							expect(expirationPolicy.isIdle()).to.be.eq(items.size === 0);
						} catch (e) {
							done(e);
						}
					}
				});

				if (checkIntervalNo === CHECK_INTERVAL_MAX) {
					if (items.size !== 0) {
						return done(new Error(`${items.size} remained at the ${checkIntervalNo} check interval, expected 0`));
					}

					try {
						expect(expirationPolicy.isIdle()).to.be.eq(true);
						itemsDeletionDelay.clear();
						return done();
					} catch (e) {
						return done(e);
					}
				}

				return undefined;
			}, checkIntervalNo * 1000 + 30);
		}

		const gcIntervalReTrackSchedulers = new Map<number, Array<Function>>();

		for (let i = SCHEDULE_DELETION_MIN_DELAY; i <= SCHEDULE_DELETION_MAX_DELAY; i++) {
			gcIntervalReTrackSchedulers.set(i, []);
			setTimeout(() => {
				gcIntervalReTrackSchedulers.get(i)!.forEach(scheduleDeletion => scheduleDeletion());
				gcIntervalReTrackSchedulers.delete(i);
			}, i * 1000);
		}

		for (let i = 0; i < SCHEDULING_TIMES; i++) {
			const scheduleDeletionDelay = number.generateRandomInt(SCHEDULE_DELETION_MIN_DELAY, SCHEDULE_DELETION_MAX_DELAY);

			gcIntervalReTrackSchedulers.get(scheduleDeletionDelay)!.push(() => {
				const item = `value${number.generateRandomInt(ITEM_MIN_RANGE, ITEM_MAX_RANGE)}`;
				const ttl = number.generateRandomInt(MIN_TTL, MAX_TTL);

				itemsDeletionDelay.set(item, ttl + scheduleDeletionDelay);

				items.add(item);
				expirationPolicy.onUpdate(item, ttl);
			});
		}
	}).timeout(10_500);
});

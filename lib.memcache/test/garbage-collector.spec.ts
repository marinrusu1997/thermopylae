import { chrono } from '@thermopylae/lib.utils';
import { describe, it } from 'mocha';
import { chai } from './chai';
import { GarbageCollector } from '../lib/garbage-collector';

const nowInSeconds = chrono.dateToUNIX;
const { expect } = chai;

describe('Garbage Collector spec', () => {
	const defaultTTL = 1; // second

	it('removes expired item', done => {
		const trackedKey = 'key';
		const whenTrackingBegan = nowInSeconds();
		const gc = new GarbageCollector(key => {
			expect(nowInSeconds() - whenTrackingBegan).to.be.equals(defaultTTL);
			expect(key).to.be.equals(trackedKey);
			done();
		});
		gc.track(trackedKey, defaultTTL);
	});

	it('removes multiple expired items with same ttl (tracking started at same time)', done => {
		const trackedKeys = ['key1', 'key2', 'key3'];
		const whenTrackingBegan = nowInSeconds();
		const gc = new GarbageCollector(key => {
			expect(nowInSeconds() - whenTrackingBegan).to.be.equals(defaultTTL);
			expect(trackedKeys).to.be.containing(key);
			trackedKeys.splice(trackedKeys.indexOf(key), 1); // ensure not called with same key
			if (trackedKeys.length === 0) {
				done();
			}
		});
		trackedKeys.forEach(key => gc.track(key, defaultTTL));
	});

	it('removes multiple expired items with different ttl (tracking started at same time)', done => {
		const trackedKeysMap = new Map<string, number>();
		trackedKeysMap.set('key1', defaultTTL);
		trackedKeysMap.set('key2', defaultTTL);
		trackedKeysMap.set('key3', defaultTTL + 1);
		trackedKeysMap.set('key4', defaultTTL + 1);
		const whenTrackingBegan = nowInSeconds();
		const gc = new GarbageCollector(key => {
			expect(nowInSeconds() - whenTrackingBegan).to.be.equals(trackedKeysMap.get(key));
			expect(Array.from(trackedKeysMap.keys())).to.be.containing(key);
			trackedKeysMap.delete(key); // ensure not called with same key
			if (trackedKeysMap.size === 0) {
				done();
			}
		});
		trackedKeysMap.forEach((ttl, key) => gc.track(key, ttl));
	}).timeout(2100);

	it('removes multiple expired items with different ttl in the order items were tracked (tracking stared at different times)', done => {
		const trackedKeysMap = new Map<string, { trackingSince: number; ttl: number }>();
		const KEYS_TO_BE_TRACKED = 4;
		let currentNumberOfRemovedKeys = 0;
		const trackedKeysSnapshot = ['key1', 'key2', 'key3', 'key4'];
		const gc = new GarbageCollector(key => {
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
		gc.track('key1', defaultTTL);

		setTimeout(() => {
			trackedKeysMap.set('key2', { trackingSince: nowInSeconds(), ttl: defaultTTL });
			gc.track('key2', defaultTTL);
		}, 1000);

		setTimeout(() => {
			trackedKeysMap.set('key3', { trackingSince: nowInSeconds(), ttl: defaultTTL });
			gc.track('key3', defaultTTL);
		}, 2000);

		setTimeout(() => {
			trackedKeysMap.set('key4', { trackingSince: nowInSeconds(), ttl: defaultTTL });
			gc.track('key4', defaultTTL);
		}, 3000);
	}).timeout(4100);

	it('removes duplicate keys with same ttl', done => {
		const trackedKeys = ['key', 'key', 'key'];
		const whenTrackingBegan = nowInSeconds();
		const gc = new GarbageCollector(key => {
			expect(nowInSeconds() - whenTrackingBegan!).to.be.equals(defaultTTL);
			expect(trackedKeys).to.be.containing(key);
			trackedKeys.splice(trackedKeys.indexOf(key), 1); // ensure not called with same key
			if (trackedKeys.length === 0) {
				done();
			}
		});
		trackedKeys.forEach(key => gc.track(key, defaultTTL));
	});

	it('restarts gc after all tracked keys were removed (new key tracked from delete handler)', done => {
		const trackedKeys = ['key1', 'key2'];
		const MAX_TRACKED_KEY_RECURSION_DEPTH = 2;
		let currentNumberOfTrackedKeys = 0;

		let whenTrackingBegan: number | undefined;

		const trackKey = (key: string): void => {
			gc.track(key, defaultTTL);
			whenTrackingBegan = nowInSeconds();
			currentNumberOfTrackedKeys += 1;
		};

		const gc = new GarbageCollector(key => {
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

	it('restarts gc after all tracked keys were removed (new key tracked using setTimeout)', done => {
		const trackedKeys = ['key1', 'key2'];
		let whenTrackingBegan: number | undefined;

		const trackKey = (key: string): void => {
			gc.track(key, defaultTTL);
			whenTrackingBegan = nowInSeconds();
		};

		const gc = new GarbageCollector(key => {
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

	it('restarts the gc after it was stopped, discarding and its internal list of tracked items', done => {
		const trackedKeyBeforeStopping = 'key1';
		const trackedKeyAfterStopping = 'key2';
		let whenTrackingBegan: number | undefined;

		const trackKey = (key: string): void => {
			gc.track(key, defaultTTL);
			whenTrackingBegan = nowInSeconds();
		};

		const gc = new GarbageCollector(key => {
			expect(nowInSeconds() - whenTrackingBegan!).to.be.equals(defaultTTL);
			expect(trackedKeyAfterStopping).to.be.equal(key);
			done();
		});

		trackKey(trackedKeyBeforeStopping);
		gc.stop();
		setTimeout(() => trackKey(trackedKeyAfterStopping), 1500);
	}).timeout(2600);
});

import { array, chrono, number, string } from '@thermopylae/lib.utils';
import { expect } from '@thermopylae/lib.unit-test';
import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { describe, it } from 'mocha';
import colors from 'colors';
import { UnitTestLogger } from '@thermopylae/lib.unit-test/dist/logger';
import { ExpirableCacheKeyEntry, ProactiveExpirationPolicy } from '../../../lib/policies/expiration/proactive';
import { EXPIRES_AT_SYM } from '../../../lib/policies/expiration/abstract';
import { Deleter, EntryValidity, SetOperationContext } from '../../../lib/contracts/replacement-policy';
import { INFINITE_TTL } from '../../../lib';

function generateEntry<K>(key: K): ExpirableCacheKeyEntry<K, any> {
	return {
		key,
		value: array.randomElement(generateEntry.VALUES),
		[EXPIRES_AT_SYM]: 0
	};
}
generateEntry.VALUES = [undefined, null, false, 0, '', {}, []];

function generateSetContext(expiresAfter?: Seconds | null, expiresFrom?: UnixTimestamp): SetOperationContext {
	// @ts-expect-error
	return { totalEntriesNo: 0, expiresAfter, expiresFrom };
}

describe(`${colors.magenta(ProactiveExpirationPolicy.name)} spec`, () => {
	const defaultTTL = 1; // second

	describe(`${ProactiveExpirationPolicy.prototype.onSet.name.magenta} spec`, () => {
		it('does not evict item if it has infinite or no ttl', (done) => {
			const POLICY = new ProactiveExpirationPolicy<string, number>();
			const EVICTED_KEYS = new Array<string>();
			const MAX_TIMEOUT = 1000;
			const TIMEOUT_STEP = 100;

			POLICY.setDeleter((key) => EVICTED_KEYS.push(key));

			for (let timeout = TIMEOUT_STEP; timeout <= MAX_TIMEOUT; timeout += TIMEOUT_STEP) {
				setTimeout(() => {
					expect(EVICTED_KEYS).to.be.ofSize(0);
					expect(POLICY.size).to.be.eq(0); // it didn't tracks nothing
					if (timeout === MAX_TIMEOUT) {
						done();
					}
				}, timeout);
			}

			POLICY.onSet('a', generateEntry('a'), generateSetContext(INFINITE_TTL));
			POLICY.onSet('b', generateEntry('b'), generateSetContext(undefined));
			POLICY.onSet('c', generateEntry('c'), generateSetContext(null));

			expect(POLICY.size).to.be.eq(0); // it didn't tracks nothing
		});

		it('evicts expired item', (done) => {
			const POLICY = new ProactiveExpirationPolicy<string, any>();

			const TRACKED_KEY = 'key';
			const WHEN_TRACKING_BEGAN = chrono.unixTime();

			const deleter: Deleter<string> = (key) => {
				expect(chrono.unixTime() - WHEN_TRACKING_BEGAN).to.be.equals(defaultTTL);
				expect(key).to.be.equals(TRACKED_KEY);

				// internal structure will be clean up after deleter is invoked
				expect(POLICY.size).to.be.eq(1);
				process.nextTick(() => {
					expect(POLICY.size).to.be.eq(0);
					done();
				});
			};

			POLICY.setDeleter(deleter);
			POLICY.onSet(TRACKED_KEY, generateEntry(TRACKED_KEY), generateSetContext(defaultTTL));
		});

		it('should not allow inserting of items which have ttl in milliseconds', () => {
			const POLICY = new ProactiveExpirationPolicy<string, any>();

			expect(() => POLICY.onSet('a', generateEntry('a'), generateSetContext(0.1))).to.throw(`'expiresAfter' needs to be an integer. Given: ${0.1}.`);
			expect(() => POLICY.onSet('a', generateEntry('a'), generateSetContext(1, 0.1))).to.throw(`'expiresFrom' needs to be an integer. Given: ${0.1}.`);

			/* const POLICY = new ProactiveExpirationPolicy<string, any>();
			const KEYS = new Map<string, Seconds>(
				array
					.filledWith(number.randomInt(1, 10), () => roundTo(number.random(0.1, 1), 1))
					.map((ttl) => [string.random({ length: 3, allowedCharRegex: /[a-z]/ }), ttl])
			);
			const KEYS_BY_TTL = new ReverseMap(KEYS);
			// const EPSILON = 10;

			const EVICTED_KEYS = new Map<string, Milliseconds>();
			POLICY.setDeleter((key) => EVICTED_KEYS.set(key, new Date().getTime()));

			// const INSERT_STARTED_AT = new Date();
			for (const [key, ttl] of KEYS) {
				POLICY.onSet(key, generateEntry(key), generateSetContext(ttl));
			}

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS.size).to.be.eq(KEYS.size);
					expect(POLICY.size).to.be.eq(0);
					expect(POLICY.isIdle()).to.be.eq(true);

					done();
				} catch (e) {
					const message = [
						'Test Context:',
						`${'KEYS'.magenta}\t\t: ${JSON.stringify([...KEYS])}`,
						`${'KEYS_BY_TTL'.magenta}\t: ${JSON.stringify([...KEYS_BY_TTL])}`,
						'',
						`${'EVICTED_KEYS'.magenta}\t: ${JSON.stringify([...EVICTED_KEYS])}`
					];
					UnitTestLogger.info(message.join('\n'));

					done(e);
				}
			}, 1050); */
			/*			let remainingTtlEvictions = KEYS_BY_TTL.value.size;
			const TIMEOUTS = new Set<NodeJS.Timeout>();

			for (const ttl of KEYS_BY_TTL.value.keys()) {
				// eslint-disable-next-line no-loop-func
				const timeout = setTimeout(() => {
					try {
						TIMEOUTS.delete(timeout);

						const keys = KEYS_BY_TTL.value.get(ttl)!;
						const expectedEvictTimestamp = INSERT_STARTED_AT.getTime() + chrono.secondsToMilliseconds(ttl);

						for (const key of keys) {
							expect(EVICTED_KEYS.has(key)).to.be.eq(true);
							expect(EVICTED_KEYS.get(key)!).to.be.below(expectedEvictTimestamp + EPSILON);
						}

						if (--remainingTtlEvictions === 0) {
							expect(EVICTED_KEYS.size).to.be.eq(KEYS.size);
							expect(POLICY.size).to.be.eq(0);
							expect(POLICY.isIdle()).to.be.eq(true);

							done();
						}
					} catch (e) {
						for (const remainingTimeout of TIMEOUTS) {
							clearTimeout(remainingTimeout);
						}
						TIMEOUTS.clear();

						const message = [
							'Test Context:',
							`${'KEYS'.magenta}\t\t: ${JSON.stringify([...KEYS])}`,
							`${'KEYS_BY_TTL'.magenta}\t: ${JSON.stringify([...KEYS_BY_TTL])}`,
							'',
							`${'EVICTED_KEYS'.magenta}\t: ${JSON.stringify([...EVICTED_KEYS])}`,
							`${'CURRENT_TTL'.magenta}: ${ttl}`
						];
						UnitTestLogger.info(message.join('\n'));

						done(e);
					}
				}, chrono.secondsToMilliseconds(ttl) + 100); // correction

				TIMEOUTS.add(timeout);
			} */
		});

		it('evicts multiple expired keys with same ttl (tracking started at same time)', (done) => {
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

		it('evicts multiple expired keys with different ttl (tracking started at same time)', (done) => {
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

		it('evicts multiple expired keys with different ttl in the order keys were tracked (tracking stared at different times)', (done) => {
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

		it('evicts duplicate keys with same ttl', (done) => {
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

		it('restarts gc after all tracked keys were evicted (new key tracked from scheduleDeletion handler)', (done) => {
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

		it('restarts gc after all tracked keys were evicted (new key tracked using setTimeout)', (done) => {
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

		it('restarts the gc after it was stopped, discarding and its internal list of tracked keys', (done) => {
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

		it('is synchronized with nearest element to remove while adding keys', async () => {
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

			await chrono.sleep(1050);
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

			await chrono.sleep(1050);
			expect(keys.size).to.be.eq(1);
			expect(expirationPolicy.size).to.be.eq(1);
			expect(keys.has('key1')).to.be.eq(false);
			expect(expirationPolicy.isIdle()).to.be.eq(false);

			await chrono.sleep(1050);
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

			await chrono.sleep(1050);
			expect(keys.size).to.be.eq(1);
			expect(expirationPolicy.size).to.be.eq(1);
			expect(keys.has('key2')).to.be.eq(false);
			expect(expirationPolicy.isIdle()).to.be.eq(false);

			await chrono.sleep(1050);
			expect(keys.size).to.be.eq(0);
			expect(expirationPolicy.size).to.be.eq(0);
			expect(expirationPolicy.isIdle()).to.be.eq(true);
		}).timeout(6000);
	});

	describe(`${ProactiveExpirationPolicy.prototype.onUpdate.name.magenta} spec`, () => {
		it('evicts key sooner if ttl decreased (ttl reported to same expiresFrom)', (done) => {
			const POLICY = new ProactiveExpirationPolicy<string, number>();
			const EVICTED_KEYS = new Array<string>();
			const KEY = 'a';
			const ENTRY = generateEntry(KEY);
			const OLD_TTL = 2;
			const NEW_TTL = 1;
			POLICY.setDeleter((key) => EVICTED_KEYS.push(key));

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(1);
					expect(EVICTED_KEYS).to.be.containing(KEY);
					expect(POLICY.size).to.be.eq(0);
					expect(POLICY.isIdle()).to.be.eq(true);
					done();
				} catch (e) {
					done(e);
				}
			}, chrono.secondsToMilliseconds(NEW_TTL) + 30);

			const expiresFrom = chrono.unixTime();
			POLICY.onSet(KEY, ENTRY, generateSetContext(OLD_TTL, expiresFrom));
			POLICY.onUpdate(KEY, ENTRY, generateSetContext(NEW_TTL, expiresFrom));
		});

		it('evicts key later if ttl increased (ttl reported to same expiresFrom)', (done) => {
			const POLICY = new ProactiveExpirationPolicy<string, number>();
			const EVICTED_KEYS = new Array<string>();
			const KEY = 'a';
			const ENTRY = generateEntry(KEY);
			const OLD_TTL = 1;
			const NEW_TTL = 2;
			POLICY.setDeleter((key) => EVICTED_KEYS.push(key));

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(0);
					expect(POLICY.size).to.be.eq(1);
					expect(POLICY.isIdle()).to.be.eq(false);
				} catch (e) {
					clearTimeout(newTtlSetTimeout);
					done(e);
				}
			}, chrono.secondsToMilliseconds(OLD_TTL) + 30);

			const newTtlSetTimeout = setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(1);
					expect(EVICTED_KEYS).to.be.containing(KEY);
					expect(POLICY.size).to.be.eq(0);
					expect(POLICY.isIdle()).to.be.eq(true);
					done();
				} catch (e) {
					done(e);
				}
			}, chrono.secondsToMilliseconds(NEW_TTL) + 30);

			const expiresFrom = chrono.unixTime();
			POLICY.onSet(KEY, ENTRY, generateSetContext(OLD_TTL, expiresFrom));
			POLICY.onUpdate(KEY, ENTRY, generateSetContext(NEW_TTL, expiresFrom));
		}).timeout(2100);

		it('evicts key later if ttl is the same (ttl reported to expiresFrom equal to current timestamp)', (done) => {
			const POLICY = new ProactiveExpirationPolicy<string, number>();
			const EVICTED_KEYS = new Array<string>();
			const KEY = 'a';
			const ENTRY = generateEntry(KEY);
			const OLD_TTL = 1;
			const NEW_TTL = 1;
			POLICY.setDeleter((key) => EVICTED_KEYS.push(key));

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(0);
					expect(POLICY.size).to.be.eq(1);
					expect(POLICY.isIdle()).to.be.eq(false);
				} catch (e) {
					clearTimeout(newTtlSetTimeout);
					done(e);
				}
			}, chrono.secondsToMilliseconds(OLD_TTL) + 30);

			const newTtlSetTimeout = setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(1);
					expect(EVICTED_KEYS).to.be.containing(KEY);
					expect(POLICY.size).to.be.eq(0);
					expect(POLICY.isIdle()).to.be.eq(true);
					done();
				} catch (e) {
					done(e);
				}
			}, chrono.secondsToMilliseconds(NEW_TTL + OLD_TTL) + 30); // schedule later

			const expiresFrom = chrono.unixTime();
			POLICY.onSet(KEY, ENTRY, generateSetContext(OLD_TTL, expiresFrom));
			POLICY.onUpdate(KEY, ENTRY, generateSetContext(NEW_TTL, expiresFrom + 1)); // schedule later
		}).timeout(2100);

		it("evicts key at it's previous timestamp if new ttl + expiresFrom will have the same eviction timestamp as the latest one", (done) => {
			const POLICY = new ProactiveExpirationPolicy<string, number>();
			const EVICTED_KEYS = new Array<string>();
			const KEY = 'a';
			const ENTRY = generateEntry(KEY);
			const OLD_TTL = 2;
			const NEW_TTL = 1;
			POLICY.setDeleter((key) => EVICTED_KEYS.push(key));

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(1);
					expect(EVICTED_KEYS).to.be.containing(KEY);
					expect(POLICY.size).to.be.eq(0);
					expect(POLICY.isIdle()).to.be.eq(true);
					done();
				} catch (e) {
					done(e);
				}
			}, chrono.secondsToMilliseconds(OLD_TTL) + 30); // NEW_TTL will have the same impact

			POLICY.onSet(KEY, ENTRY, generateSetContext(OLD_TTL));

			setTimeout(() => {
				POLICY.onUpdate(KEY, ENTRY, generateSetContext(NEW_TTL)); // generates same eviction timestamp
			}, chrono.secondsToMilliseconds(NEW_TTL));
		}).timeout(2100);

		it('does not evict key if it had tll, but the new one is infinite', (done) => {
			const POLICY = new ProactiveExpirationPolicy<string, number>();
			const EVICTED_KEYS = new Array<string>();
			const KEY = 'a';
			const ENTRY = generateEntry(KEY);
			const OLD_TTL = 1;
			POLICY.setDeleter((key) => EVICTED_KEYS.push(key));

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(0);
					expect(POLICY.size).to.be.eq(0); // does not track it
					expect(POLICY.isIdle()).to.be.eq(true);
					done();
				} catch (e) {
					done(e);
				}
			}, chrono.secondsToMilliseconds(OLD_TTL) + 50);

			const expiresFrom = chrono.unixTime();
			POLICY.onSet(KEY, ENTRY, generateSetContext(OLD_TTL, expiresFrom));

			setTimeout(() => {
				POLICY.onUpdate(KEY, ENTRY, generateSetContext(INFINITE_TTL));
			}, 500);
		});

		it("evicts the key if it didn't had tll, and the new ttl is specified", (done) => {
			const POLICY = new ProactiveExpirationPolicy<string, number>();
			const EVICTED_KEYS = new Array<string>();
			const KEY = 'a';
			const ENTRY = generateEntry(KEY);
			const NEW_TTL = 1;
			POLICY.setDeleter((key) => EVICTED_KEYS.push(key));

			POLICY.onSet(KEY, ENTRY, generateSetContext(null));
			POLICY.onUpdate(KEY, ENTRY, generateSetContext(NEW_TTL));

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(1);
					expect(EVICTED_KEYS).to.be.containing(KEY);
					expect(POLICY.size).to.be.eq(0);
					expect(POLICY.isIdle()).to.be.eq(true);
					done();
				} catch (e) {
					done(e);
				}
			}, chrono.secondsToMilliseconds(NEW_TTL) + 50);
		});

		it("does not evict key if it didn't had ttl, and the new ttl is infinite/not specified", (done) => {
			const POLICY = new ProactiveExpirationPolicy<string, number>();
			const EVICTED_KEYS = new Array<string>();
			const KEY = 'a';
			const ENTRY = generateEntry(KEY);
			POLICY.setDeleter((key) => EVICTED_KEYS.push(key));

			POLICY.onSet(KEY, ENTRY, generateSetContext(null));
			setTimeout(() => {
				POLICY.onUpdate(KEY, ENTRY, generateSetContext());
			}, 500);

			let checkAttempts = 0;
			const intervalId = setInterval(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(0);
					expect(POLICY.size).to.be.eq(0); // does not track
					expect(POLICY.isIdle()).to.be.eq(true);

					if (++checkAttempts >= 10) {
						clearInterval(intervalId);
						done();
					}
				} catch (e) {
					clearInterval(intervalId);
					done(e);
				}
			}, 100);
		});

		it('is synchronized with nearest element to remove while adding/updating keys', (done) => {
			const POLICY = new ProactiveExpirationPolicy<string, any>();
			const CACHE_ACTIVE_KEYS = new Set<string>();

			POLICY.setDeleter((key) => CACHE_ACTIVE_KEYS.delete(key));
			expect(POLICY.isIdle()).to.be.eq(true);

			const MIN_TTL = 1;
			const MAX_TTL = 5;

			const ITEM_MIN_RANGE = 1;
			const ITEM_MAX_RANGE = 100;

			const SCHEDULING_TIMES = 500;

			const SCHEDULE_DELETION_MIN_DELAY = 0;
			const SCHEDULE_DELETION_MAX_DELAY = 4;

			const CHECK_INTERVAL_MIN = MIN_TTL;
			const CHECK_INTERVAL_MAX = MAX_TTL * 2;

			const KEYS_DELETION_DELAY = new Map<string, number>();

			function logTestContext(checkIntervalNo?: number): void {
				const message = [
					'Test Context:',
					`${'POLICY_SIZE'.magenta}\t\t: ${POLICY.size}`,
					`${'CACHE_ACTIVE_KEYS'.magenta}: ${JSON.stringify([...CACHE_ACTIVE_KEYS])}`,
					`${'KEYS_DELETION_DELAY'.magenta}\t: ${JSON.stringify([...KEYS_DELETION_DELAY])}`
				];
				if (checkIntervalNo != null) {
					message.push(`${'CHECK_INTERVAL_NO'.magenta}: ${checkIntervalNo}`);
				}

				UnitTestLogger.info(message.join('\n'));
			}

			for (let checkIntervalNo = CHECK_INTERVAL_MIN; checkIntervalNo <= CHECK_INTERVAL_MAX; checkIntervalNo++) {
				// eslint-disable-next-line no-loop-func
				setTimeout(() => {
					KEYS_DELETION_DELAY.forEach((deleteAtIntervalNo, key) => {
						if (deleteAtIntervalNo === checkIntervalNo) {
							try {
								expect(CACHE_ACTIVE_KEYS.has(key)).to.be.eq(false);
								expect(POLICY.isIdle()).to.be.eq(CACHE_ACTIVE_KEYS.size === 0);
							} catch (e) {
								logTestContext(checkIntervalNo);
								done(e);
							}
						}
					});

					if (checkIntervalNo === CHECK_INTERVAL_MAX) {
						try {
							if (CACHE_ACTIVE_KEYS.size !== 0) {
								throw new Error(`${CACHE_ACTIVE_KEYS.size} remained at the ${checkIntervalNo} check interval, expected 0`);
							}

							expect(POLICY.isIdle()).to.be.eq(true);
							expect(POLICY.size).to.be.eq(0);
							KEYS_DELETION_DELAY.clear();

							return done();
						} catch (e) {
							logTestContext();
							return done(e);
						}
					}

					return undefined;
				}, checkIntervalNo * 1000 + 40); // just in case system resources are move busy
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

					KEYS_DELETION_DELAY.set(key, ttl + scheduleDeletionDelay);

					CACHE_ACTIVE_KEYS.add(key);
					POLICY.onUpdate(key, generateEntry(key), generateSetContext(ttl));
				});
			}
		}).timeout(10_500);
	});

	describe(`${ProactiveExpirationPolicy.prototype.onHit.name.magenta} spec`, () => {
		it('does nothing on hit and returns entry as being valid, as it will be evicted later by timer', () => {
			const policy = new ProactiveExpirationPolicy<string, number>();
			const isValid = policy.onHit();
			expect(isValid).to.be.eq(EntryValidity.VALID);
		});
	});

	describe(`${ProactiveExpirationPolicy.prototype.onDelete.name.magenta} spec`, () => {
		it('does not require entry on deletion', () => {
			const policy = new ProactiveExpirationPolicy();
			expect(policy.requiresEntryOnDeletion).to.be.eq(false);
		});

		it("does not remove keys that don't have expiration", () => {
			const policy = new ProactiveExpirationPolicy<string, any>();
			policy.onSet('a', generateEntry('a'), generateSetContext(null));
			expect(policy.size).to.be.eq(0);

			policy.onDelete('a'); // expecting not to throw
			expect(policy.size).to.be.eq(0);
		});

		it('removes entry from internal tracking after it is deleted', (done) => {
			const policy = new ProactiveExpirationPolicy<string, any>();
			const EVICTED_KEYS = new Array<string>();
			policy.setDeleter((key) => EVICTED_KEYS.push(key));

			const KEYS_BY_TTL = new Map<number, string[]>([
				[1, array.filledWith(number.randomInt(0, 10), () => string.random({ length: 3, allowedCharRegex: /[a-zA-Z]/ }))],
				[2, array.filledWith(number.randomInt(0, 10), () => string.random({ length: 3, allowedCharRegex: /[a-zA-Z]/ }))],
				[3, array.filledWith(number.randomInt(0, 10), () => string.random({ length: 3, allowedCharRegex: /[a-zA-Z]/ }))]
			]);

			let totalEntries = 0;
			for (const [ttl, keys] of KEYS_BY_TTL) {
				if (!keys.length) {
					continue;
				}
				totalEntries += keys.length;

				const context = generateSetContext(ttl);
				for (const key of keys) {
					policy.onSet(key, generateEntry(key), context);
				}

				setTimeout(() => {
					for (const key of array.shuffle(keys)) {
						// delete them in random order
						policy.onDelete(key);
					}
				}, chrono.secondsToMilliseconds(ttl - 1));
			}
			expect(policy.size).to.be.eq(totalEntries);

			setTimeout(() => {
				try {
					expect(EVICTED_KEYS).to.be.ofSize(0); // all of they were deleted explicitly, there was no need to evict them
					expect(policy.size).to.be.eq(0); // all of them were deleted
					expect(policy.isIdle()).to.be.eq(true); // gc should stop
					done();
				} catch (e) {
					done(e);
				}
			}, 3100);
		}).timeout(3200);
	});
});

// @ts-ignore
import stringify from 'fast-stable-stringify';

type Key = string | number | symbol | bigint;
type MemoizationRegion = Key;
type MemoizationZone = Key;
type MemoizationLocation = Key;
type MemoizationRecord = NonNullable<any | Promise<any>>;

type MemoizationLocationResolver = (args: any[]) => MemoizationLocation;

const enum MemoizationImpulseType {
	ASYNC,
	SYNC
}

type ZoneCache = Map<MemoizationLocation, MemoizationRecord>;
type RegionCache = Map<MemoizationZone, ZoneCache>;

const HIPPOCAMPUS = new Map<MemoizationRegion, RegionCache>();

const MEMOIZATION_MARKER = Symbol.for('MEMOIZED');

function getRegion(region: MemoizationRegion): RegionCache {
	let regionCache = HIPPOCAMPUS.get(region);
	if (regionCache == null) {
		regionCache = new Map<MemoizationZone, ZoneCache>();
		HIPPOCAMPUS.set(region, regionCache);
	}

	return regionCache;
}

function getZone(region: MemoizationRegion, zone: MemoizationZone): ZoneCache {
	const regionCache = getRegion(region);

	let zoneCache = regionCache.get(zone);
	if (zoneCache == null) {
		zoneCache = new Map<MemoizationLocation, MemoizationRecord>();
		regionCache.set(zone, zoneCache);
	}

	return zoneCache;
}

function implicitLocationResolver(args: any[]): string {
	return stringify(args);
}

function memoize(
	region: MemoizationRegion,
	zone: MemoizationZone,
	impulseType = MemoizationImpulseType.ASYNC,
	locationResolver: MemoizationLocationResolver = implicitLocationResolver
): MethodDecorator {
	return (target, propertyKey, descriptor: TypedPropertyDescriptor<any>): void => {
		if (typeof descriptor.value !== 'function') {
			throw new Error(`Property ${propertyKey.toString()} on ${target.constructor.name} has to be a method.`);
		}

		if (Reflect.get(descriptor.value, MEMOIZATION_MARKER) === true) {
			throw new Error(`Method ${propertyKey.toString()} on ${target.constructor.name} has been decorated already with the ${memoize.name} decorator.`);
		}

		const synapse = descriptor.value;

		switch (impulseType) {
			case MemoizationImpulseType.ASYNC:
				descriptor.value = async function (...impulses: any[]): Promise<any> {
					const zoneCache = getZone(region, zone);

					const location = locationResolver(impulses);
					let recordPromise: any;

					if ((recordPromise = zoneCache.get(location)) != null) {
						return recordPromise;
					}

					recordPromise = new Promise((resolve, reject) =>
						(synapse.apply(target, impulses) as Promise<any>)
							.then((record) => {
								if (record == null) {
									zoneCache.delete(location);
								}
								resolve(record);
							})
							.catch((mediationError) => {
								zoneCache.delete(location);
								reject(mediationError);
							})
					);

					zoneCache.set(location, recordPromise);

					return recordPromise;
				};
				break;
			case MemoizationImpulseType.SYNC:
				descriptor.value = function (...impulses: any[]): any {
					const zoneCache = getZone(region, zone);

					const location = locationResolver(impulses);
					let record: any;

					if ((record = zoneCache.get(location)) != null) {
						return record;
					}

					record = synapse.apply(target, impulses);
					if (record != null) {
						zoneCache.set(location, record);
					}

					return record;
				};
				break;
			default:
				throw new Error(`Unknown computation type. Given ${impulseType}.`);
		}

		Reflect.set(descriptor.value, MEMOIZATION_MARKER, true);
	};
}

function amnesia(region: MemoizationRegion, zone?: MemoizationZone, location?: MemoizationLocation): MethodDecorator {
	return (target, propertyKey, descriptor: TypedPropertyDescriptor<any>): void => {
		if (typeof descriptor.value !== 'function') {
			throw new Error(`Property ${propertyKey.toString()} on ${target.constructor.name} has to be a method.`);
		}

		const synapse = descriptor.value;

		descriptor.value = function (...impulses: any[]): any {
			const regionCache = HIPPOCAMPUS.get(region);

			if (regionCache != null) {
				if (zone == null) {
					for (const zoneCache of regionCache.values()) {
						zoneCache.clear();
					}
				} else {
					const zoneCache = regionCache.get(zone);
					if (zoneCache) {
						if (location) {
							zoneCache.delete(location);
						} else {
							zoneCache.clear();
						}
					}
				}
			}

			return synapse.apply(target, impulses);
		};
	};
}

export { MemoizationImpulseType, MemoizationLocationResolver, memoize, amnesia };

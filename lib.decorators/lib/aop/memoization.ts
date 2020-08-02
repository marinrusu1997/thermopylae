// @ts-ignore
import stringify from 'fast-stable-stringify';
import { ObjMap, Class, Nullable, Optional } from '@thermopylae/core.declarations';

type Key = string | number | symbol | bigint;
type MemoizationRegion = Key;
type MemoizationZone = Key;
type MemoizationLocation = Key;
type MemoizationRecord = NonNullable<any | Promise<any>>;

type MemoizationLocationResolver = (args: any[]) => MemoizationLocation;

const enum MemoizationBoundary {
	INSTANCE,
	CLASS,
	CROSS
}

type MemoizationBoundaryLocator = ObjMap | Class<any>;

interface MemoizationStorage {
	store(
		region: MemoizationRegion,
		zone: MemoizationZone,
		boundary: MemoizationBoundary,
		boundaryLocator: MemoizationBoundaryLocator,
		location: MemoizationLocation,
		record: MemoizationRecord
	): void;

	retrieve(
		region: MemoizationRegion,
		zone: MemoizationZone,
		boundary: MemoizationBoundary,
		boundaryLocator: MemoizationBoundaryLocator,
		location: MemoizationLocation
	): Optional<MemoizationRecord>;

	forget(
		boundary: MemoizationBoundary,
		boundaryLocator: Nullable<MemoizationBoundaryLocator>,
		region: MemoizationRegion,
		zone?: MemoizationZone,
		location?: MemoizationLocation
	): boolean;
}

type ZoneCache = Map<MemoizationLocation, MemoizationRecord>;
type BoundaryZoneCache = Partial<{
	[MemoizationBoundary.INSTANCE]: WeakMap<ObjMap, ZoneCache>;
	[MemoizationBoundary.CLASS]: Map<Class<any>, ZoneCache>;
	[MemoizationBoundary.CROSS]: ZoneCache;
}>;
type RegionCache = Map<MemoizationZone, BoundaryZoneCache>;

class Hippocampus implements MemoizationStorage {
	private readonly storage: Map<MemoizationRegion, RegionCache>;

	public constructor() {
		this.storage = new Map<MemoizationRegion, RegionCache>();
	}

	public store(
		region: MemoizationRegion,
		zone: MemoizationZone,
		boundary: MemoizationBoundary,
		boundaryLocator: MemoizationBoundaryLocator,
		location: MemoizationLocation,
		record: MemoizationRecord
	) {
		const zoneCache = this.getZone(region, zone, boundary, boundaryLocator);
		zoneCache.set(location, record);
	}

	public retrieve(
		region: MemoizationRegion,
		zone: MemoizationZone,
		boundary: MemoizationBoundary,
		boundaryLocator: MemoizationBoundaryLocator,
		location: MemoizationLocation
	): Optional<MemoizationRecord> {
		const regionCache = this.storage.get(region);
		if (regionCache == null) {
			return undefined;
		}

		const boundaryZoneCache = regionCache.get(zone);
		if (boundaryZoneCache == null) {
			return undefined;
		}

		const zoneCache = Hippocampus.getOptionalZoneCache(boundaryZoneCache, boundary, boundaryLocator);
		if (zoneCache == null) {
			return undefined;
		}

		return zoneCache.get(location);
	}

	public forget(
		boundary: MemoizationBoundary,
		boundaryLocator: MemoizationBoundaryLocator,
		region: MemoizationRegion,
		zone?: MemoizationZone,
		location?: MemoizationLocation
	): boolean {
		const regionCache = this.storage.get(region);
		if (regionCache == null) {
			return false;
		}

		if (zone == null) {
			for (const boundaryZoneCache of regionCache.values()) {
				const zoneCache = Hippocampus.getOptionalZoneCache(boundaryZoneCache, boundary, boundaryLocator);
				if (zoneCache) {
					zoneCache.clear();
				}
			}

			return true;
		}

		const boundaryZoneCache = regionCache.get(zone);
		if (boundaryZoneCache != null) {
			const zoneCache = Hippocampus.getOptionalZoneCache(boundaryZoneCache, boundary, boundaryLocator);
			if (zoneCache != null) {
				if (location != null) {
					zoneCache.delete(location);
				} else {
					zoneCache.clear();
				}

				return true;
			}
		}

		return false;
	}

	private getRegion(region: MemoizationRegion): RegionCache {
		let regionCache = this.storage.get(region);
		if (regionCache == null) {
			regionCache = new Map<MemoizationZone, BoundaryZoneCache>();
			this.storage.set(region, regionCache);
		}

		return regionCache;
	}

	private getBoundaryZone(region: MemoizationRegion, zone: MemoizationZone): BoundaryZoneCache {
		const regionCache = this.getRegion(region);

		let boundaryZoneCache = regionCache.get(zone);
		if (boundaryZoneCache == null) {
			boundaryZoneCache = {};
			regionCache.set(zone, boundaryZoneCache);
		}

		return boundaryZoneCache;
	}

	private getZone(region: MemoizationRegion, zone: MemoizationZone, boundary: MemoizationBoundary, boundaryLocator: MemoizationBoundaryLocator): ZoneCache {
		const boundaryZoneCache = this.getBoundaryZone(region, zone);

		switch (boundary) {
			case MemoizationBoundary.INSTANCE: {
				let zoneInstanceCache = boundaryZoneCache[boundary];

				if (zoneInstanceCache == null) {
					zoneInstanceCache = new WeakMap<ObjMap, ZoneCache>();
					boundaryZoneCache[boundary] = zoneInstanceCache;
				}

				let zoneCache = zoneInstanceCache.get(boundaryLocator);
				if (zoneCache == null) {
					zoneCache = new Map<MemoizationLocation, MemoizationRecord>();
					zoneInstanceCache.set(boundaryLocator, zoneCache);
				}

				return zoneCache;
			}

			case MemoizationBoundary.CLASS: {
				let zoneClassCache = boundaryZoneCache[boundary];

				if (zoneClassCache == null) {
					zoneClassCache = new Map<Class<any>, ZoneCache>();
					boundaryZoneCache[boundary] = zoneClassCache;
				}

				let zoneCache = zoneClassCache.get(boundaryLocator as Class<any>);
				if (zoneCache == null) {
					zoneCache = new Map<MemoizationLocation, MemoizationRecord>();
					zoneClassCache.set(boundaryLocator as Class<any>, zoneCache);
				}

				return zoneCache;
			}

			case MemoizationBoundary.CROSS: {
				let zoneCache = boundaryZoneCache[boundary];

				if (zoneCache == null) {
					zoneCache = new Map<MemoizationLocation, MemoizationRecord>();
					boundaryZoneCache[boundary] = zoneCache;
				}

				return zoneCache;
			}
			default:
				throw new Error(`Unknown memoization boundary. Given: ${boundary}`);
		}
	}

	private static getOptionalZoneCache(
		boundaryZoneCache: BoundaryZoneCache,
		boundary: MemoizationBoundary,
		boundaryLocator: MemoizationBoundaryLocator
	): Optional<ZoneCache> {
		switch (boundary) {
			case MemoizationBoundary.INSTANCE: {
				const zoneInstanceCache = boundaryZoneCache[boundary];
				if (zoneInstanceCache == null) {
					return undefined;
				}

				return zoneInstanceCache.get(boundaryLocator);
			}
			case MemoizationBoundary.CLASS: {
				const zoneClassCache = boundaryZoneCache[boundary];
				if (zoneClassCache == null) {
					return undefined;
				}

				return zoneClassCache.get(boundaryLocator as Class<any>);
			}
			case MemoizationBoundary.CROSS:
				return boundaryZoneCache[boundary] as ZoneCache;
			default:
				throw new Error(`Unknown memoization boundary. Given: ${boundary}`);
		}
	}
}

function implicitLocationResolver(args: any[]): string {
	return stringify(args);
}

const MEMOIZATION_MARKER = Symbol.for('MEMOIZED');
let Storage: MemoizationStorage = new Hippocampus();

function memoize(
	region: MemoizationRegion,
	zone: MemoizationZone,
	locationResolver: MemoizationLocationResolver = implicitLocationResolver,
	boundary?: MemoizationBoundary
): MethodDecorator {
	return (target, propertyKey, descriptor: TypedPropertyDescriptor<any>): void => {
		if (typeof descriptor.value !== 'function') {
			throw new Error(`Property ${propertyKey.toString()} on ${target.constructor.name} has to be a method.`);
		}

		if (Reflect.get(descriptor.value, MEMOIZATION_MARKER) === true) {
			throw new Error(`Method ${propertyKey.toString()} on ${target.constructor.name} has been decorated already with the ${memoize.name} decorator.`);
		}

		const synapse = descriptor.value;

		descriptor.value = function memoizationProxy(...impulses: any[]): any {
			const location = locationResolver(impulses);
			boundary = boundary || Object.getPrototypeOf(this) === target ? MemoizationBoundary.INSTANCE : MemoizationBoundary.CLASS;
			const boundaryLocator = boundary === MemoizationBoundary.INSTANCE ? this : target;

			let record: any;

			if ((record = Storage.retrieve(region, zone, boundary, boundaryLocator, location)) != null) {
				return record;
			}

			record = synapse.apply(this, impulses);
			if (record != null) {
				if (record instanceof Promise) {
					record
						.then((result) => {
							if (result == null) {
								Storage.forget(boundary!, boundaryLocator, region, zone, location);
							}
							return result;
						})
						.catch((mediationError) => {
							Storage.forget(boundary!, boundaryLocator, region, zone, location);
							throw mediationError;
						});
				}

				Storage.store(region, zone, boundary, boundaryLocator, location, record);
			}

			return record;
		};

		Reflect.set(descriptor.value, MEMOIZATION_MARKER, true);
	};
}
memoize.use = function (storage: MemoizationStorage): void {
	Storage = storage;
};

function amnesia(region: MemoizationRegion, zone?: MemoizationZone, location?: MemoizationLocation, boundary?: MemoizationBoundary): MethodDecorator {
	return (target, propertyKey, descriptor: TypedPropertyDescriptor<any>): void => {
		if (typeof descriptor.value !== 'function') {
			throw new Error(`Property ${propertyKey.toString()} on ${target.constructor.name} has to be a method.`);
		}

		const synapse = descriptor.value;

		descriptor.value = function amnesiaProxy(...impulses: any[]): any {
			boundary = boundary || Object.getPrototypeOf(this) === target ? MemoizationBoundary.INSTANCE : MemoizationBoundary.CLASS;
			const boundaryLocator = boundary === MemoizationBoundary.INSTANCE ? this : target;
			Storage.forget(boundary, boundaryLocator, region, zone, location);
			return synapse.apply(this, impulses);
		};
	};
}

export { MemoizationLocationResolver, MemoizationBoundary, MemoizationStorage, Storage, memoize, amnesia };

import type GeoIPLite from 'geoip-lite';
import type { IpLocation, IpLocationsRepository } from './index.js';

/** @private */
// oxlint-disable consistent-type-imports
type GeoIPLite = typeof import('geoip-lite');

/**
 * Repository which fetches ip locations from [geoip-lite](https://www.npmjs.com/package/geoip-lite)
 * local database. <br/> When using this repository, please take care to [update your local geoip
 * database](https://www.npmjs.com/package/geoip-lite#built-in-updater).
 */
class GeoIpLiteRepository implements IpLocationsRepository {
	private static geoipLite: GeoIPLite;

	readonly #weight: number;

	/** @param weight Repository weight. */
	public constructor(weight: number) {
		if (weight <= 0) {
			throw new Error(`Weight can't be lower or equal to 0. Given: ${weight}.`);
		}

		this.#weight = weight;
	}

	/** @inheritdoc */
	public get id(): string {
		return 'geoip-lite';
	}

	/** @inheritdoc */
	public get weight(): number {
		return this.#weight;
	}

	/** @inheritdoc */
	public get available(): boolean {
		return true;
	}

	/** @inheritdoc */
	public async lookup(ip: string): Promise<IpLocation | null> {
		const geoipLite = await GeoIpLiteRepository.geoipLiteInstance();

		const geo = geoipLite.lookup(ip);
		if (!geo) {
			return null;
		}

		return {
			REPOSITORY_ID: this.id,
			countryCode: geo.country,
			regionCode: geo.region,
			city: geo.city,
			timezone: geo.timezone,
			latitude: geo.ll[0],
			longitude: geo.ll[1]
		};
	}

	/**
	 * Refresh in-memory database which contains
	 * [geoip-lite](https://www.npmjs.com/package/geoip-lite) locations.
	 *
	 * > **CAUTION!** <br/> This needs to be called after updating local _geoip-lite_ db.
	 */
	public static async refresh(): Promise<void> {
		const geoipLite = await GeoIpLiteRepository.geoipLiteInstance();

		return new Promise<void>((resolve, reject) => {
			// oxlint-disable-next-line prefer-await-to-callbacks
			geoipLite.reloadData((err) => (err ? reject(err) : resolve()));
		});
	}

	private static async geoipLiteInstance(): Promise<GeoIPLite> {
		// it needs to be lazily loaded, because on import it loads the whole maxmind database in RAM
		if (!GeoIpLiteRepository.geoipLite) {
			const geoipLiteModule = await import('geoip-lite');
			GeoIpLiteRepository.geoipLite = geoipLiteModule.default;
		}
		return GeoIpLiteRepository.geoipLite;
	}
}

export { GeoIpLiteRepository };

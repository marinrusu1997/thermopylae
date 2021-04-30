import type { IpLocation, IpLocationsRepository } from './index';
import { logger } from '../logger';

/**
 * @private
 */
type GeoIPLite = typeof import('geoip-lite');

/**
 * Repository which fetches ip locations from [geoip-lite](https://www.npmjs.com/package/geoip-lite) local database.
 */
class GeoIpLiteRepository implements IpLocationsRepository {
	private static geoipLite: GeoIPLite;

	private readonly w: number;

	/**
	 * @param weight	Repository weight.
	 */
	public constructor(weight: number) {
		if (weight <= 0) {
			throw new Error(`Weight can't be lower or equal to 0. Given: ${weight}.`);
		}

		this.w = weight;
	}

	/**
	 * @inheritDoc
	 */
	public get id(): string {
		return 'geoip-lite';
	}

	/**
	 * @inheritDoc
	 */
	public get weight(): number {
		return this.w;
	}

	/**
	 * @inheritDoc
	 */
	public get available(): boolean {
		return true;
	}

	/**
	 * @inheritDoc
	 */
	public async lookup(ip: string): Promise<IpLocation | null> {
		const geoipLite = await GeoIpLiteRepository.geoipLiteInstance();

		const geo = geoipLite.lookup(ip);
		if (!geo) {
			return null;
		}

		logger.debug(`geoip-lite found location of the ${ip}`);
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
	 * Refresh in-memory database which contains [geoip-lite](https://www.npmjs.com/package/geoip-lite) locations.
	 * > 	**CAUTION!** <br/>
	 * > This needs to be called after updating local *geoip-lite* db.
	 */
	public static async refresh(): Promise<void> {
		const geoipLite = await GeoIpLiteRepository.geoipLiteInstance();

		return new Promise<void>((resolve, reject) => {
			geoipLite.reloadData((err) => (err ? reject(err) : resolve()));
		});
	}

	private static async geoipLiteInstance(): Promise<GeoIPLite> {
		// it needs to be lazily loaded, because on import it loads the whole maxmind database in RAM
		if (!GeoIpLiteRepository.geoipLite) {
			GeoIpLiteRepository.geoipLite = await import('geoip-lite');
		}
		return GeoIpLiteRepository.geoipLite;
	}
}

export { GeoIpLiteRepository };

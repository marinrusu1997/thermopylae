import { chrono } from '@thermopylae/lib.utils';
import fetch from 'node-fetch';
import type { IpLocation, IpLocationsRepository } from './index';
import { logger } from '../logger';

/**
 * @private
 */
const AVAILABLE_NOW = -1;

/**
 * [API Guide](https://www.iplocate.com/en/developer/api-guide)
 */
interface IpLocateRepositoryOptions {
	/**
	 * API key provided for registered application.
	 */
	readonly apiKey?: string;
	/**
	 * Weight of the repo.
	 */
	readonly weight: number;
}

/**
 * Repository which fetches ip locations from [iplocate](https://www.iplocate.com/en/developer/api-guide).
 */
class IpLocateRepository implements IpLocationsRepository {
	private readonly options: IpLocateRepositoryOptions;

	private availableAt: number;

	public constructor(options: IpLocateRepositoryOptions) {
		if (options.weight <= 0) {
			throw new Error(`Weight can't be lower or equal to 0. Given: ${options.weight}.`);
		}

		this.options = options;
		this.availableAt = AVAILABLE_NOW;
	}

	/**
	 * @inheritDoc
	 */
	public get id(): string {
		return 'iplocate';
	}

	/**
	 * @inheritDoc
	 */
	public get weight(): number {
		return this.options.weight;
	}

	/**
	 * @inheritDoc
	 */
	public get available(): boolean {
		return this.availableAt === AVAILABLE_NOW || this.availableAt < chrono.unixTime();
	}

	/**
	 * @inheritDoc
	 */
	public async lookup(ip: string): Promise<IpLocation | null> {
		let location = null;

		if (this.availableAt === AVAILABLE_NOW) {
			try {
				location = await this.retrieve(ip);
			} catch (e) {
				logger.error(`Failed to retrieve location for ip ${ip} from iplocate.`, e);
			}
		} else if (this.availableAt < chrono.unixTime()) {
			try {
				location = await this.retrieve(ip);
				this.availableAt = AVAILABLE_NOW;
			} catch (e) {
				logger.error(`Failed to retrieve location for ip ${ip} from iplocate.`, e);
			}
		}

		return location;
	}

	private async retrieve(ip: string): Promise<IpLocation> {
		const response = await fetch(`https://www.iplocate.io/api/lookup/${ip}`, {
			method: 'get',
			headers: {
				'X-API-Key': this.options.apiKey!
			}
		});

		if (response.headers.get('X-RateLimit-Remaining') === '0') {
			const rateLimitReset = response.headers.get('X-RateLimit-Reset')!;
			logger.warning(`Rate limit for iplocate exceeded and will reset at ${rateLimitReset}.`);

			this.availableAt = chrono.unixTime(new Date(rateLimitReset));
		}

		const location = await response.json();
		logger.debug(`iplocate found location of the ${ip}`);

		return {
			REPOSITORY_ID: this.id,
			countryCode: location.country_code,
			regionCode: null,
			city: location.city,
			timezone: location.time_zone,
			latitude: location.latitude,
			longitude: location.longitude
		};
	}
}

export { IpLocateRepository, IpLocateRepositoryOptions };

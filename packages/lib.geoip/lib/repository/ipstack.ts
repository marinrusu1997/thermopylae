import { chrono } from '@thermopylae/lib.utils';
import fetch from 'node-fetch';
import type { IpLocation, IpLocationsRepository } from './index';

/**
 * @private
 */
const AVAILABLE_NOW = -1;

/**
 * [API Guide](https://ipstack.com/documentation)
 */
interface IpstackRepositoryOptions {
	/**
	 * Service api key.
	 */
	readonly apiKey: string;
	/**
	 * Protocol used to fetch ip location.
	 */
	readonly proto: 'http' | 'https';
	/**
	 * Language of the location details.
	 *
	 * Code     | Language
	 * -------- | -------------
	 * en       | English/US
	 * de       | German
	 * es       | Spanish
	 * fr       | French
	 * ja       | Japanese
	 * pt-br    | Portuguese (Brazil)
	 * ru       | Russian
	 * zh       | Chinese
	 */
	readonly lang: 'en' | 'de' | 'es' | 'fr' | 'ja' | 'pt-br' | 'ru' | 'zh';
	/**
	 * Weight of the repo.
	 */
	readonly weight: number;
	/**
	 * Hooks.
	 */
	readonly hooks: {
		/**
		 * Hook called when ip retrieval fails with an error.
		 *
		 * @param err	Error that was thrown.
		 */
		onIpRetrievalError: (err: Error) => void;
	};
}

/**
 * Repository which fetches ip locations from [ipstack](https://ipstack.com/documentation).
 */
class IpstackRepository implements IpLocationsRepository {
	private readonly options: IpstackRepositoryOptions;

	private availableAt: number;

	public constructor(options: IpstackRepositoryOptions) {
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
		return 'ipstack';
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
			} catch (error) {
				// error thrown after successful request has been made, check if limit reached, see https://ipstack.com/documentation
				if (!(error instanceof Error) && error.code === 104 && (error.type === 'usage_limit_reached' || error.type === 'monthly_limit_reached')) {
					this.availableAt = chrono.unixTime(chrono.firstDayOfNextMonth());
				}

				this.options.hooks.onIpRetrievalError(error);
			}
		} else if (this.availableAt < chrono.unixTime()) {
			try {
				location = await this.retrieve(ip);
				// api call succeeded, this means that our guess that limit expired was correct
				this.availableAt = AVAILABLE_NOW;
			} catch (error) {
				// false positive, out guess failed, can happen when there is a delay between our time and service time
				// IMPORTANT: DO NOT CHANGE AVAILABILITY TIMESTAMP, it will be reset on next retry

				this.options.hooks.onIpRetrievalError(error);
			}
		}

		return location;
	}

	private async retrieve(ip: string): Promise<IpLocation> {
		const response = await fetch(this.buildUrl(ip), { method: 'get' });
		const location = await response.json();

		if (location.success === false) {
			throw location.error;
		}

		return {
			REPOSITORY_ID: this.id,
			countryCode: location.country_code,
			regionCode: location.region_code,
			city: location.city,
			timezone: (location.time_zone && location.time_zone.id) || null,
			latitude: location.latitude,
			longitude: location.longitude
		};
	}

	private buildUrl(ip: string): string {
		return `${this.options.proto}://api.ipstack.com/${ip}?access_key=${this.options.apiKey}&fields=country_code,region_code,city,latitude,longitude,zip,time_zone.id&language=${this.options.lang}`;
	}
}

export { IpstackRepository, IpstackRepositoryOptions };

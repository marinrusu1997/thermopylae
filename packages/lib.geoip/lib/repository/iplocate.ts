import type { ObjMap } from '@thermopylae/core.declarations';
import { chrono } from '@thermopylae/lib.utils';
import { convert } from 'convert';
import fetch from 'node-fetch';
import type { IpLocation, IpLocationsRepository } from './index.js';

/** @private */
const AVAILABLE_NOW = -1;

/** [API Guide](https://www.iplocate.com/en/developer/api-guide) */
interface IpLocateRepositoryOptions {
	/** API key provided for registered application. */
	readonly apiKey?: string;
	/** Weight of the repo. */
	readonly weight: number;
	/** Hooks. */
	readonly hooks: {
		/**
		 * Hook called when ip retrieval fails with an error.
		 *
		 * @param err Error that was thrown.
		 */
		onIpRetrievalError: (err: Error) => void;
		/**
		 * Hook called when rate limit was reached.
		 *
		 * @param rateLimitReset Date-time when rate limit will be reset.
		 */
		onRateLimitExceeded: (rateLimitReset: Date) => void;
	};
}

/**
 * Repository which fetches ip locations from
 * [iplocate](https://www.iplocate.com/en/developer/api-guide).
 */
class IpLocateRepository implements IpLocationsRepository {
	private readonly options: IpLocateRepositoryOptions;

	private availableAt: number;

	public constructor(options: IpLocateRepositoryOptions) {
		/* c8 ignore next 3 */
		if (options.weight <= 0) {
			throw new Error(`Weight can't be lower or equal to 0. Given: ${options.weight}.`);
		}

		this.options = options;
		this.availableAt = AVAILABLE_NOW;
	}

	/** @inheritdoc */
	public get id(): string {
		return 'iplocate';
	}

	/** @inheritdoc */
	public get weight(): number {
		return this.options.weight;
	}

	/** @inheritdoc */
	public get available(): boolean {
		return this.availableAt === AVAILABLE_NOW || /* c8 ignore next */ this.availableAt < chrono.unix();
	}

	/** @inheritdoc */
	public async lookup(ip: string): Promise<IpLocation | null> {
		let location = null;

		if (this.availableAt === AVAILABLE_NOW) {
			try {
				location = await this.retrieve(ip);
				/* c8 ignore start */
			} catch (error) {
				this.options.hooks.onIpRetrievalError(error as Error);
			}
		} else if (this.availableAt < chrono.unix()) {
			try {
				location = await this.retrieve(ip);
				this.availableAt = AVAILABLE_NOW;
			} catch (error) {
				this.options.hooks.onIpRetrievalError(error as Error);
			}
		}
		/* c8 ignore stop */

		return location;
	}

	private async retrieve(ip: string): Promise<IpLocation> {
		const response = await fetch(`https://www.iplocate.io/api/lookup/${ip}`, {
			method: 'get',
			headers: {
				'X-API-Key': this.options.apiKey ?? ''
			}
		});

		if (response.headers.get('X-RateLimit-Remaining') === '0') {
			const rateLimitResetHeader = response.headers.get('X-RateLimit-Reset');
			if (rateLimitResetHeader) {
				const rateLimitReset = new Date(rateLimitResetHeader);
				this.options.hooks.onRateLimitExceeded(rateLimitReset);
				this.availableAt = Math.round(convert(rateLimitReset.getTime(), 'ms').to('s'));
			}
		}

		const location = (await response.json()) as ObjMap;

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

export { IpLocateRepository, type IpLocateRepositoryOptions };

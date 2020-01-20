import { http, chrono } from '@marin/lib.utils';
import geoip from 'geoip-lite';
import { getLogger } from './logger';

export interface Location {
	countryCode: string | null;
	regionCode: string | null;
	city: string | null;
	timeZone: string | null;
	latitude: number | null;
	longitude: number | null;
	postalCode?: string | null;
}

const NOT_EXPIRED = -1;

class GeoIP {
	private readonly ipstackAPIKey: string;

	// can be safely kept only in memory, no need for persistent storage, on first limit reached error they will be initialized
	private readonly limitExpire: { ipstack: number; iplocate: number };

	constructor(ipStackAPIKey: string) {
		this.ipstackAPIKey = ipStackAPIKey;
		this.limitExpire = {
			ipstack: NOT_EXPIRED,
			iplocate: NOT_EXPIRED
		};
	}

	private retrieveLocationFromIpStackService(ip: string): Promise<Location> {
		return http.makeHTTPRequest(`http://api.ipstack.com/${ip}?access_key=${this.ipstackAPIKey}`, { method: 'GET' }).then((response: any) => {
			if (response.success === false) {
				throw response.error;
			}

			return {
				countryCode: response.country_code,
				regionCode: response.region_code,
				city: response.city,
				timeZone: response.time_zone ? response.time_zone.id : null,
				latitude: response.latitude,
				longitude: response.longitude,
				postalCode: response.zip
			};
		});
	}

	private static retrieveLocationFromIPLocateService(ip: string): Promise<Location> {
		return http.makeHTTPSRequest(`https://www.iplocate.io/api/lookup/${ip}`, { method: 'GET' }).then((response: any) => {
			return {
				countryCode: response.country_code,
				regionCode: null,
				city: response.city,
				timeZone: response.time_zone,
				latitude: response.latitude,
				longitude: response.longitude,
				postalCode: response.postal_code
			};
		});
	}

	private static retrieveLocationFromGeoIpLite(ip: string): Location {
		const geo = geoip.lookup(ip);
		return {
			countryCode: geo.country,
			regionCode: geo.region,
			city: geo.city,
			// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
			// @ts-ignore
			timeZone: geo.timezone,
			latitude: geo.ll[0],
			longitude: geo.ll[1],
			postalCode: null
		};
	}

	public async location(ip: string): Promise<Location | null> {
		const now = chrono.dateToUNIX();

		if (this.limitExpire.ipstack === NOT_EXPIRED) {
			try {
				return this.retrieveLocationFromIpStackService(ip);
			} catch (error) {
				// check if limit reached, see https://ipstack.com/documentation
				if (error.code === 104) {
					this.limitExpire.ipstack = chrono.dateToUNIX(chrono.firstDayOfNextMonth());
				}
				getLogger().error(`Failed to retrieve location for ip ${ip} from ipstack. `, error);
			}
		} else if (now > this.limitExpire.ipstack) {
			try {
				const response = await this.retrieveLocationFromIpStackService(ip);
				// api call succeeded, this means that our guess that limit expired was correct
				this.limitExpire.ipstack = NOT_EXPIRED;
				return response;
			} catch (error) {
				// false positive, out guess failed, can happen when there is a delay between our time and service time
				// IMPORTANT: DO NOT CHANGE LIMIT EXPIRE TIMESTAMP, it will be reset on next retry

				getLogger().error(`Failed to retrieve location for ip ${ip} from ipstack. `, error);
			}
		}

		if (this.limitExpire.iplocate === NOT_EXPIRED) {
			try {
				return await GeoIP.retrieveLocationFromIPLocateService(ip);
			} catch (e) {
				// check status code, 429 means limit reached, see https://www.iplocate.io/#documentation
				// perform weak comparison, just in case error code is string
				// eslint-disable-next-line eqeqeq
				if (e.code == '429') {
					this.limitExpire.iplocate = chrono.dateToUNIX(chrono.tomorrow());
				}
				getLogger().error(`Failed to retrieve location for ip ${ip} from iplocate. `, e);
			}
		} else if (now > this.limitExpire.iplocate) {
			try {
				const response = await GeoIP.retrieveLocationFromIPLocateService(ip);
				// api call succeeded, this means that our guess that limit expired was correct
				this.limitExpire.iplocate = NOT_EXPIRED;
				return response;
			} catch (e) {
				// false positive, same as for ipstack
				getLogger().error(`Failed to retrieve location for ip ${ip} from iplocate. `, e);
			}
		}

		// geoip lite fallback
		return GeoIP.retrieveLocationFromGeoIpLite(ip);
	}

	public static refresh(): Promise<void> {
		// see https://www.npmjs.com/package/geoip-lite
		return new Promise<void>((resolve, reject) => {
			// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
			// @ts-ignore
			geoip.reloadData(err => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});
	}
}

export { GeoIP };

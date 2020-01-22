import { http, chrono } from '@marin/lib.utils';
import geoip from 'geoip-lite';
import { getLogger } from './logger';

interface Location {
	countryCode: string | null;
	regionCode: string | null;
	city: string | null;
	timeZone: string | null;
	latitude: number | null;
	longitude: number | null;
	postalCode?: string | null;
}

type HTTPResponse = http.HTTPResponse;

// minimal http client interface required by geo ip
interface HTTPClient {
	request: (url: string, params: { method: string }) => Promise<HTTPResponse>;
	secure: (url: string, params: { method: string }) => Promise<HTTPResponse>;
}

const NOT_EXPIRED = -1;

class GeoIP {
	private readonly ipStackAPIKey: string;

	private readonly httpClient: HTTPClient;

	// can be safely kept only in memory, no need for persistent storage, on first limit reached error they will be initialized
	private readonly limitExpire: { ipStack: number; ipLocate: number };

	constructor(ipStackAPIKey: string, httpClient: HTTPClient = { request: http.makeHTTPRequest, secure: http.makeHTTPSRequest }) {
		this.ipStackAPIKey = ipStackAPIKey;
		this.httpClient = httpClient;
		this.limitExpire = {
			ipStack: NOT_EXPIRED,
			ipLocate: NOT_EXPIRED
		};
	}

	private retrieveLocationFromIpStackService(ip: string): Promise<Location> {
		return this.httpClient.request(`http://api.ipstack.com/${ip}?access_key=${this.ipStackAPIKey}`, { method: 'GET' }).then((response: HTTPResponse) => {
			const body = response.data as any;

			if (body.success === false) {
				throw body.error;
			}

			return {
				countryCode: body.country_code,
				regionCode: body.region_code,
				city: body.city,
				timeZone: null,
				latitude: body.latitude,
				longitude: body.longitude,
				postalCode: body.zip
			};
		});
	}

	private retrieveLocationFromIPLocateService(ip: string): Promise<Location> {
		return this.httpClient.secure(`https://www.iplocate.io/api/lookup/${ip}`, { method: 'GET' }).then((response: HTTPResponse) => {
			const body = response.data as any;

			return {
				countryCode: body.country_code,
				regionCode: null,
				city: body.city,
				timeZone: body.time_zone,
				latitude: body.latitude,
				longitude: body.longitude,
				postalCode: body.postal_code
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

		if (this.limitExpire.ipStack === NOT_EXPIRED) {
			try {
				return this.retrieveLocationFromIpStackService(ip);
			} catch (error) {
				// error thrown after successful request has been made, check if limit reached, see https://ipstack.com/documentation
				if (typeof error === 'object' && error.code === 104) {
					this.limitExpire.ipStack = chrono.dateToUNIX(chrono.firstDayOfNextMonth());
				}
				getLogger().error(`Failed to retrieve location for ip ${ip} from ipstack. `, error);
			}
		} else if (now > this.limitExpire.ipStack) {
			try {
				const ipStackLocation = await this.retrieveLocationFromIpStackService(ip);
				// api call succeeded, this means that our guess that limit expired was correct
				this.limitExpire.ipStack = NOT_EXPIRED;
				return ipStackLocation;
			} catch (error) {
				// false positive, out guess failed, can happen when there is a delay between our time and service time
				// IMPORTANT: DO NOT CHANGE LIMIT EXPIRE TIMESTAMP, it will be reset on next retry

				getLogger().error(`Failed to retrieve location for ip ${ip} from ipstack. `, error);
			}
		}

		if (this.limitExpire.ipLocate === NOT_EXPIRED) {
			try {
				return await this.retrieveLocationFromIPLocateService(ip);
			} catch (e) {
				// check status code of the http response (not network err or smth), 429 means limit reached, see https://www.iplocate.io/#documentation
				// eslint-disable-next-line eqeqeq
				if (!(e instanceof Error) && e.status === 429) {
					this.limitExpire.ipLocate = chrono.dateToUNIX(chrono.tomorrow());
				}
				getLogger().error(`Failed to retrieve location for ip ${ip} from iplocate. `, e);
			}
		} else if (now > this.limitExpire.ipLocate) {
			try {
				const ipLocateServiceLocation = await this.retrieveLocationFromIPLocateService(ip);
				// api call succeeded, this means that our guess that limit expired was correct
				this.limitExpire.ipLocate = NOT_EXPIRED;
				return ipLocateServiceLocation;
			} catch (e) {
				// false positive, same as for ipstack
				getLogger().error(`Failed to retrieve location for ip ${ip} from iplocate. `, e);
			}
		}

		// geoip lite fallback
		return GeoIP.retrieveLocationFromGeoIpLite(ip);
	}

	/**
	 * Refresh in-memory database which contains geoip-lite locations.
	 * CAUTION! This needs to be called after updating local geoip-lite db.
	 */
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

// eslint-disable-next-line no-undef
export { GeoIP, Location, HTTPClient, HTTPResponse };

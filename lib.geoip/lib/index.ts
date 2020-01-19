import { http } from '@marin/lib.utils';
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

// FIXME handle service limits error, see https://medium.com/@rossbulat/node-js-client-ip-location-with-geoip-lite-fallback-c25833c94a76

// FIXME handle auto-watch for geoip local db updates

class GeoIP {
	private static ipstackAPIKey: string;

	public static init(ipStackAPIKey: string): void {
		GeoIP.ipstackAPIKey = ipStackAPIKey;
	}

	private static retrieveLocationFromIpStack(ip: string): Promise<Location> {
		return http.makeHTTPRequest(`http://api.ipstack.com/${ip}?access_key=${GeoIP.ipstackAPIKey}`, { method: 'GET' }).then((response: any) => {
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

	private static retrieveLocationFromIPLocate(ip: string): Promise<Location> {
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

	public static async location(ip: string): Promise<Location> {
		// retrieve from ipstack
		try {
			return await GeoIP.retrieveLocationFromIpStack(ip);
		} catch (e) {
			getLogger().error(`Failed to retrieve location for ip ${ip} from ipstack. `, e);
		}

		// retrieve from iplocate
		try {
			return await GeoIP.retrieveLocationFromIPLocate(ip);
		} catch (e) {
			getLogger().error(`Failed to retrieve location for ip ${ip} from iplocate. `, e);
		}

		// retrieve from geoip lite
		return GeoIP.retrieveLocationFromGeoIpLite(ip);
	}
}

export { GeoIP };

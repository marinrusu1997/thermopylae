import { http, chrono } from '@marin/lib.utils';
import { getLogger } from './logger';
import { createException, ErrorCodes } from './error';

interface IpLocation {
	countryCode: string | null;
	regionCode: string | null;
	city: string | null;
	timeZone: string | null;
	latitude: number | null;
	longitude: number | null;
	postalCode?: string | null;
}

type HTTPResponse = http.HTTPResponse;

interface HTTPClient {
	request: (url: string, params: { method: string }) => Promise<HTTPResponse>;
	secure: (url: string, params: { method: string }) => Promise<HTTPResponse>;
}

const enum ExternalService {
	IPSTACK = 'IPSTACK',
	IPLOCATE = 'IPLOCATE'
}

type ExternalServiceLoadBalancer = () => Array<ExternalService>;

const NOT_EXPIRED = -1;

const defaultHttpClient = { request: http.makeHTTPRequest, secure: http.makeHTTPSRequest };
const defaultExternalServiceLoadBalancer = () => {
	const servicesOrder = [];
	servicesOrder[0] = Math.random() <= 0.5 ? ExternalService.IPSTACK : ExternalService.IPLOCATE;
	servicesOrder[1] = servicesOrder[0] === ExternalService.IPSTACK ? ExternalService.IPLOCATE : ExternalService.IPSTACK;
	return servicesOrder;
};

class GeoIP {
	private readonly ipStackAPIKey: string;

	private readonly httpClient: HTTPClient;

	private readonly externalServiceLoadBalancer: ExternalServiceLoadBalancer;

	private readonly whenLimitsWillExpire: { ipStack: number; ipLocate: number };

	private static geoipLite: any;

	// @ts-ignore
	private static readonly requestLocationFromExternalServices = new Map([
		[ExternalService.IPSTACK, GeoIP.prototype.retrieveFromIpStackIfLimitNotExpired],
		[ExternalService.IPLOCATE, GeoIP.prototype.retrieveFromIpLocateIfLimitNotExpired],
		['GEOIP-LITE', GeoIP.retrieveLocationFromGeoIpLite]
	]);

	/**
	 * Pass only api key if you want to use defaults for http client and external service load balancer.
	 * Pass `null` if you want to use default implementations for those args, along with your custom ones for another ones.
	 * Notice that load balancer needs to create different arrays on subsequent calls and return them.
	 *
	 * @param ipStackAPIKey					Api Key for ipstack external service.
	 * @param httpClient					Http client used to make requests to external services
	 * @param externalServiceLoadBalancer	Load balancer which chooses external service where the next request will be made.
	 */
	constructor(
		ipStackAPIKey: string,
		httpClient: HTTPClient | null = defaultHttpClient,
		externalServiceLoadBalancer: ExternalServiceLoadBalancer | null = defaultExternalServiceLoadBalancer
	) {
		this.ipStackAPIKey = ipStackAPIKey;
		this.httpClient = httpClient || defaultHttpClient;
		this.externalServiceLoadBalancer = externalServiceLoadBalancer || defaultExternalServiceLoadBalancer;
		this.whenLimitsWillExpire = {
			ipStack: NOT_EXPIRED,
			ipLocate: NOT_EXPIRED
		};
	}

	/**
	 * Retrieves location associated with an IP.
	 *
	 * @throws {Exception}	When location couldn't be found.
	 */
	// @ts-ignore
	public async locate(ip: string): Promise<IpLocation> {
		const currentTimeUNIX = chrono.dateToUNIX();
		const externalServicesOrder = this.externalServiceLoadBalancer();
		// @ts-ignore this is an optimisation, last request is made against local database
		externalServicesOrder.push('GEOIP-LITE');

		let location;

		for (let i = 0; i < externalServicesOrder.length; i++) {
			location = await GeoIP.requestLocationFromExternalServices.get(externalServicesOrder[i])!.call(this, ip, currentTimeUNIX);
			if (location) {
				return location;
			}
		}

		if (!location) {
			throw createException(ErrorCodes.IP_LOCATION_NOT_FOUND, `Couldn't locate ip ${ip}. `);
		}
	}

	/**
	 * Refresh in-memory database which contains geoip-lite locations.
	 * CAUTION! This needs to be called after updating local geoip-lite db.
	 */
	public static async refresh(): Promise<void> {
		if (!GeoIP.geoipLite) {
			GeoIP.geoipLite = await import('geoip-lite');
		}

		// see https://www.npmjs.com/package/geoip-lite
		return new Promise<void>((resolve, reject) => {
			// @ts-ignore
			GeoIP.geoipLite.reloadData(err => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});
	}

	private retrieveLocationFromIpStackService(ip: string): Promise<IpLocation> {
		return this.httpClient.request(`http://api.ipstack.com/${ip}?access_key=${this.ipStackAPIKey}`, { method: 'GET' }).then((response: HTTPResponse) => {
			const body = response.data as any;

			if (body.success === false) {
				throw body.error;
			}

			return {
				countryCode: body.country_code || null,
				regionCode: body.region_code || null,
				city: body.city || null,
				timeZone: null,
				latitude: body.latitude || null,
				longitude: body.longitude || null,
				postalCode: body.zip || null
			};
		});
	}

	private retrieveLocationFromIPLocateService(ip: string): Promise<IpLocation> {
		return this.httpClient.secure(`https://www.iplocate.io/api/lookup/${ip}`, { method: 'GET' }).then((response: HTTPResponse) => {
			const body = response.data as any;

			return {
				countryCode: body.country_code || null,
				regionCode: null,
				city: body.city || null,
				timeZone: body.time_zone || null,
				latitude: body.latitude || null,
				longitude: body.longitude || null,
				postalCode: body.postal_code || null
			};
		});
	}

	private static async retrieveLocationFromGeoIpLite(ip: string): Promise<IpLocation | null> {
		if (!GeoIP.geoipLite) {
			GeoIP.geoipLite = await import('geoip-lite');
		}

		const geo = GeoIP.geoipLite.lookup(ip);
		if (!geo) {
			return null;
		}

		return {
			countryCode: geo.country || null,
			regionCode: geo.region || null,
			city: geo.city || null,
			// @ts-ignore
			timeZone: geo.timezone || null,
			latitude: geo.ll[0] || null,
			longitude: geo.ll[1] || null,
			postalCode: null
		};
	}

	private async retrieveFromIpStackIfLimitNotExpired(ip: string, currentTimeUNIX: number): Promise<IpLocation | null> {
		let location = null;

		if (this.whenLimitsWillExpire.ipStack === NOT_EXPIRED) {
			try {
				location = await this.retrieveLocationFromIpStackService(ip);
			} catch (error) {
				// error thrown after successful request has been made, check if limit reached, see https://ipstack.com/documentation
				if (!(error instanceof Error) && error.code === 104 && error.type === 'monthly_limit_reached') {
					this.whenLimitsWillExpire.ipStack = chrono.dateToUNIX(chrono.firstDayOfNextMonth());
				}

				getLogger().error(`Failed to retrieve location for ip ${ip} from ipstack. `, error);
			}
		} else if (currentTimeUNIX > this.whenLimitsWillExpire.ipStack) {
			try {
				location = await this.retrieveLocationFromIpStackService(ip);
				// api call succeeded, this means that our guess that limit expired was correct
				this.whenLimitsWillExpire.ipStack = NOT_EXPIRED;
			} catch (error) {
				// false positive, out guess failed, can happen when there is a delay between our time and service time
				// IMPORTANT: DO NOT CHANGE LIMIT EXPIRE TIMESTAMP, it will be reset on next retry

				getLogger().error(`Failed to retrieve location for ip ${ip} from ipstack. `, error);
			}
		}

		return location;
	}

	private async retrieveFromIpLocateIfLimitNotExpired(ip: string, currentTimeUNIX: number): Promise<IpLocation | null> {
		let location = null;

		if (this.whenLimitsWillExpire.ipLocate === NOT_EXPIRED) {
			try {
				location = await this.retrieveLocationFromIPLocateService(ip);
			} catch (e) {
				// check status code of the http response (not network err or smth), 429 means limit reached, see https://www.iplocate.io/#documentation
				if (!(e instanceof Error) && e.status === 429) {
					this.whenLimitsWillExpire.ipLocate = chrono.dateToUNIX(chrono.tomorrow());
				}
				getLogger().error(`Failed to retrieve location for ip ${ip} from iplocate. `, e);
			}
		} else if (currentTimeUNIX > this.whenLimitsWillExpire.ipLocate) {
			try {
				location = await this.retrieveLocationFromIPLocateService(ip);
				// api call succeeded, this means that our guess that limit expired was correct
				this.whenLimitsWillExpire.ipLocate = NOT_EXPIRED;
			} catch (e) {
				// false positive, same as for ipstack
				getLogger().error(`Failed to retrieve location for ip ${ip} from iplocate. `, e);
			}
		}

		return location;
	}
}

// eslint-disable-next-line no-undef
export { GeoIP, IpLocation, HTTPClient, HTTPResponse, ExternalService, ExternalServiceLoadBalancer, ErrorCodes };
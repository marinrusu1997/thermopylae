import { before, describe, it } from 'mocha';
import { expect } from 'chai';
import { config as dotEnvConfig } from 'dotenv';
import LoggerInstance from '@marin/lib.logger';
import { chrono } from '@marin/lib.utils';
// eslint-disable-next-line import/no-unresolved
import { Libraries } from '@marin/lib.utils/dist/enums';
import Exception from '@marin/lib.error';
import { GeoIP, ExternalService, ErrorCodes } from '../lib';
import { HttpClientMock, ServiceFailureType } from './http-client-mock';

describe('geoip spec', () => {
	let ipstackAccessKey: string | undefined;

	before(() => {
		const dotEnv = dotEnvConfig();
		if (dotEnv.error) {
			throw dotEnv.error;
		}

		ipstackAccessKey = process.env.IPSTACK_ACCESS_KEY;

		if (!ipstackAccessKey) {
			throw new Error('Could not load ip stack access key from env variable');
		}

		LoggerInstance.console.setConfig({ level: 'emerg' }); // suppress error logs
	});

	const externalServiceLoadBalancerMock = () => [ExternalService.IPSTACK, ExternalService.IPLOCATE];

	it('retrieves location', async () => {
		const geoip = new GeoIP(ipstackAccessKey!);
		const location = await geoip.locate('8.8.8.8');
		expect(location).not.to.be.eq(null);
		expect(location!.countryCode).to.be.eq('US');
		expect(location!.regionCode).to.be.oneOf(['CA', null]);
		expect(location!.city).to.be.oneOf(['Mountain View', null]);
		expect(location!.timeZone).to.be.oneOf(['America/Los_Angeles', 'America/Chicago', null]);
		expect(location!.postalCode).to.be.oneOf(['94041', null]);
		expect(location!.latitude).to.be.oneOf([37.38801956176758, 37.751]);
		expect(location!.longitude).to.be.oneOf([-122.07431030273438, -97.822]);
	});

	it('retrieves location when partially specialized', async () => {
		const geoip = new GeoIP(ipstackAccessKey!, null, () => [ExternalService.IPLOCATE, ExternalService.IPSTACK]);
		const location = await geoip.locate('8.8.8.8');
		expect(location).not.to.be.eq(null);
		expect(location!.countryCode).to.be.eq('US');
		expect(location!.regionCode).to.be.eq(null);
		expect(location!.city).to.be.eq(null);
		expect(location!.timeZone).to.be.eq('America/Chicago');
		expect(location!.postalCode).to.be.eq(null);
		expect(location!.latitude).to.be.eq(37.751);
		expect(location!.longitude).to.be.eq(-97.822);
	});

	it('refresh local ip database in a fast manner (less than 400 ms)', async () => {
		const begin = new Date().getTime();
		await GeoIP.refresh();
		const end = new Date().getTime();
		expect(end - begin).to.be.lte(400);
	});

	it("throws when could't find location", async () => {
		const httpClient = new HttpClientMock();
		const geoip = new GeoIP(ipstackAccessKey!, httpClient);

		httpClient.serviceFailures.ipStack = ServiceFailureType.NETWORK;
		httpClient.serviceFailures.ipLocate = ServiceFailureType.NETWORK;

		const ip = '255.255.255.255';
		let err;
		try {
			await geoip.locate('255.255.255.255');
		} catch (e) {
			err = e;
		}
		expect(err)
			.to.be.instanceOf(Exception)
			.and.to.haveOwnProperty('emitter', Libraries.GEO_IP);
		expect(err).to.haveOwnProperty('code', ErrorCodes.IP_LOCATION_NOT_FOUND);
		expect(err).to.haveOwnProperty('message', `Couldn't locate ip ${ip}.`);
	});

	it('does fallback to iplocate if ipstack service call failed (unavailable)', async () => {
		const httpClient = new HttpClientMock();
		httpClient.serviceFailures.ipStack = ServiceFailureType.NETWORK;

		const geoip = new GeoIP(ipstackAccessKey!, httpClient, externalServiceLoadBalancerMock);
		const location = await geoip.locate('8.8.8.8');

		expect(httpClient.serviceCalls.ipStack).to.be.eq(1);
		expect(httpClient.serviceCalls.ipLocate).to.be.eq(1);
		expect(location!.countryCode).to.be.eq(HttpClientMock.COUNTRY_CODES.IP_LOCATE);
	});

	it('does fallback to geoip-lite if both service calls failed (unavailable)', async () => {
		const httpClient = new HttpClientMock();
		httpClient.serviceFailures.ipStack = ServiceFailureType.NETWORK;
		httpClient.serviceFailures.ipLocate = ServiceFailureType.NETWORK;

		const geoip = new GeoIP(ipstackAccessKey!, httpClient, externalServiceLoadBalancerMock);
		const location = await geoip.locate('8.8.8.8');

		// they were called...
		expect(httpClient.serviceCalls.ipStack).to.be.eq(1);
		expect(httpClient.serviceCalls.ipLocate).to.be.eq(1);

		// ... but failed (check just in case in future these constants may change)
		expect(location!.countryCode).not.to.be.eq(HttpClientMock.COUNTRY_CODES.IP_STACK);
		expect(location!.countryCode).not.to.be.eq(HttpClientMock.COUNTRY_CODES.IP_LOCATE);

		// retrieved from local geoip-lite
		expect(location!.countryCode).to.be.eq('US');
	});

	it('does not call ipstack service if limit reached', async () => {
		const httpClient = new HttpClientMock();
		httpClient.serviceFailures.ipStack = ServiceFailureType.LIMIT_EXPIRED;

		const geoip = new GeoIP(ipstackAccessKey!, httpClient, externalServiceLoadBalancerMock);

		// first call resolved with ip stack and ip locate service
		let location = await geoip.locate('8.8.8.8');
		expect(httpClient.serviceCalls.ipStack).to.be.eq(1);
		expect(httpClient.serviceCalls.ipLocate).to.be.eq(1);
		expect(location!.countryCode).to.be.eq(HttpClientMock.COUNTRY_CODES.IP_LOCATE);

		// second call resolved directly with ip locate service
		httpClient.resetServiceCalls();
		location = await geoip.locate('8.8.8.8');
		expect(httpClient.serviceCalls.ipStack).to.be.eq(0);
		expect(httpClient.serviceCalls.ipLocate).to.be.eq(1);
		expect(location!.countryCode).to.be.eq(HttpClientMock.COUNTRY_CODES.IP_LOCATE);
	});

	it('does not call iplocate service if limit reached', async () => {
		const httpClient = new HttpClientMock();
		httpClient.serviceFailures.ipStack = ServiceFailureType.NETWORK; // let the location being resolved with ip locate
		httpClient.serviceFailures.ipLocate = ServiceFailureType.LIMIT_EXPIRED;

		const geoip = new GeoIP(ipstackAccessKey!, httpClient, externalServiceLoadBalancerMock);

		// first call resolved with geoip lite
		let location = await geoip.locate('8.8.8.8');
		expect(httpClient.serviceCalls.ipStack).to.be.eq(1);
		expect(httpClient.serviceCalls.ipLocate).to.be.eq(1);
		expect(location!.countryCode).to.be.eq('US');

		// second call resolved directly with geoip-lite
		httpClient.resetServiceCalls();
		location = await geoip.locate('8.8.8.8');
		expect(httpClient.serviceCalls.ipStack).to.be.eq(1); // still called because of last network error
		expect(httpClient.serviceCalls.ipLocate).to.be.eq(0);
		expect(location!.countryCode).to.be.eq('US');
	});

	it('resets internal reached limit for ipstack on successfull response after expiry time', async () => {
		const httpClient = new HttpClientMock();
		httpClient.serviceFailures.ipStack = ServiceFailureType.LIMIT_EXPIRED;

		const geoip = new GeoIP(ipstackAccessKey!, httpClient, externalServiceLoadBalancerMock);
		const now = chrono.dateToUNIX();

		// detect that limit expired for ipstack
		await geoip.locate('8.8.8.8');
		// @ts-ignore very unsafe, but we have to test this somehow
		expect(geoip.whenLimitsWillExpire.ipStack).to.be.eq(chrono.dateToUNIX(chrono.firstDayOfNextMonth()));

		// reset limit expired for ipstack
		// @ts-ignore
		geoip.whenLimitsWillExpire.ipStack = now - 1;
		httpClient.serviceFailures.ipStack = undefined;
		httpClient.resetServiceCalls();

		let location = await geoip.locate('8.8.8.8');
		expect(httpClient.serviceCalls.ipStack).to.be.eq(1);
		expect(httpClient.serviceCalls.ipLocate).to.be.eq(0);
		expect(location!.countryCode).to.be.eq(HttpClientMock.COUNTRY_CODES.IP_STACK);
		// @ts-ignore very unsafe, but we have to test this somehow
		expect(geoip.whenLimitsWillExpire.ipStack).to.be.eq(-1);

		location = await geoip.locate('8.8.8.8');
		expect(location!.countryCode).to.be.eq(HttpClientMock.COUNTRY_CODES.IP_STACK);
	});

	it('does not resets internal reached limit for ipstack on error response after expiry time', async () => {
		const httpClient = new HttpClientMock();
		httpClient.serviceFailures.ipStack = ServiceFailureType.LIMIT_EXPIRED;

		const geoip = new GeoIP(ipstackAccessKey!, httpClient, externalServiceLoadBalancerMock);
		const now = chrono.dateToUNIX();

		// detect that limit expired for ipstack
		await geoip.locate('8.8.8.8');
		// @ts-ignore very unsafe, but we have to test this somehow
		expect(geoip.whenLimitsWillExpire.ipStack).to.be.eq(chrono.dateToUNIX(chrono.firstDayOfNextMonth()));

		// reset limit expired for ipstack
		// @ts-ignore
		geoip.whenLimitsWillExpire.ipStack = now - 1;
		httpClient.resetServiceCalls();

		const location = await geoip.locate('8.8.8.8');
		expect(httpClient.serviceCalls.ipStack).to.be.eq(1); // it tried to call service, because internal expiry timestamp is old
		expect(httpClient.serviceCalls.ipLocate).to.be.eq(1);
		expect(location!.countryCode).to.be.eq(HttpClientMock.COUNTRY_CODES.IP_LOCATE);
		// @ts-ignore very unsafe, but we have to test this somehow
		expect(geoip.whenLimitsWillExpire.ipStack).to.not.be.eq(-1);
	});

	it('does resets internal reached limit for iplocate on success response after expiry time', async () => {
		const httpClient = new HttpClientMock();
		httpClient.serviceFailures.ipStack = ServiceFailureType.LIMIT_EXPIRED;
		httpClient.serviceFailures.ipLocate = ServiceFailureType.LIMIT_EXPIRED;

		const geoip = new GeoIP(ipstackAccessKey!, httpClient, externalServiceLoadBalancerMock);
		const now = chrono.dateToUNIX();

		// detect that limit expired for ipstack and iplocate
		await geoip.locate('8.8.8.8');
		// @ts-ignore very unsafe, but we have to test this somehow
		expect(geoip.whenLimitsWillExpire.ipStack).to.be.eq(chrono.dateToUNIX(chrono.firstDayOfNextMonth()));
		// @ts-ignore very unsafe, but we have to test this somehow
		expect(geoip.whenLimitsWillExpire.ipLocate).to.be.eq(chrono.dateToUNIX(chrono.tomorrow()));

		// reset limit expired for iplocate
		// @ts-ignore
		geoip.whenLimitsWillExpire.ipLocate = now - 1;
		httpClient.serviceFailures.ipLocate = undefined;
		httpClient.resetServiceCalls();

		let location = await geoip.locate('8.8.8.8');
		expect(httpClient.serviceCalls.ipStack).to.be.eq(0); // won't be called because of expiry limit
		expect(httpClient.serviceCalls.ipLocate).to.be.eq(1); // try to call
		expect(location!.countryCode).to.be.eq(HttpClientMock.COUNTRY_CODES.IP_LOCATE);
		// @ts-ignore very unsafe, but we have to test this somehow
		expect(geoip.whenLimitsWillExpire.ipStack).to.be.eq(chrono.dateToUNIX(chrono.firstDayOfNextMonth()));
		// @ts-ignore very unsafe, but we have to test this somehow
		expect(geoip.whenLimitsWillExpire.ipLocate).to.be.eq(-1);

		location = await geoip.locate('8.8.8.8');
		expect(location!.countryCode).to.be.eq(HttpClientMock.COUNTRY_CODES.IP_LOCATE);
	});

	it('does not reset internal reached count limit for iplocate on failure response after expiry time', async () => {
		const httpClient = new HttpClientMock();
		httpClient.serviceFailures.ipStack = ServiceFailureType.LIMIT_EXPIRED;
		httpClient.serviceFailures.ipLocate = ServiceFailureType.LIMIT_EXPIRED;

		const geoip = new GeoIP(ipstackAccessKey!, httpClient, externalServiceLoadBalancerMock);
		const now = chrono.dateToUNIX();

		// detect that limit expired for ipstack and iplocate
		await geoip.locate('8.8.8.8');
		// @ts-ignore very unsafe, but we have to test this somehow
		expect(geoip.whenLimitsWillExpire.ipStack).to.be.eq(chrono.dateToUNIX(chrono.firstDayOfNextMonth()));
		// @ts-ignore very unsafe, but we have to test this somehow
		expect(geoip.whenLimitsWillExpire.ipLocate).to.be.eq(chrono.dateToUNIX(chrono.tomorrow()));

		// @ts-ignore
		geoip.whenLimitsWillExpire.ipLocate = now - 1;
		httpClient.resetServiceCalls();

		const location = await geoip.locate('8.8.8.8');
		expect(httpClient.serviceCalls.ipStack).to.be.eq(0); // won't be called because of expiry limit
		expect(httpClient.serviceCalls.ipLocate).to.be.eq(1); // will try to call, because internal expiry timestamp is old
		expect(location!.countryCode).to.be.eq('US'); // but will fallback to geoip-lite
		// @ts-ignore very unsafe, but we have to test this somehow
		expect(geoip.whenLimitsWillExpire.ipStack).to.be.eq(chrono.dateToUNIX(chrono.firstDayOfNextMonth()));
		// @ts-ignore very unsafe, but we have to test this somehow
		expect(geoip.whenLimitsWillExpire.ipLocate).to.not.be.eq(-1);
	});

	it('a new instance of GeoIp which tries to call services with expired limit detects it and computes correctly reset timestamp', async () => {
		const httpClient = new HttpClientMock();
		const firstGeoipInstance = new GeoIP(ipstackAccessKey!, httpClient, externalServiceLoadBalancerMock);
		const secondGeoipInstance = new GeoIP(ipstackAccessKey!, httpClient, externalServiceLoadBalancerMock);

		await firstGeoipInstance.locate('8.8.8.8');
		expect(httpClient.serviceCalls.ipStack).to.be.eq(1);
		expect(httpClient.serviceCalls.ipLocate).to.be.eq(0);

		httpClient.resetServiceCalls();
		httpClient.serviceFailures.ipStack = ServiceFailureType.LIMIT_EXPIRED;
		httpClient.serviceFailures.ipLocate = ServiceFailureType.LIMIT_EXPIRED;

		// first instance detects that limit expired for ipstack and iplocate
		await firstGeoipInstance.locate('8.8.8.8');
		// @ts-ignore very unsafe, but we have to test this somehow
		expect(firstGeoipInstance.whenLimitsWillExpire.ipStack).to.be.eq(chrono.dateToUNIX(chrono.firstDayOfNextMonth()));
		// @ts-ignore very unsafe, but we have to test this somehow
		expect(firstGeoipInstance.whenLimitsWillExpire.ipLocate).to.be.eq(chrono.dateToUNIX(chrono.tomorrow()));
		expect(httpClient.serviceCalls.ipStack).to.be.eq(1);
		expect(httpClient.serviceCalls.ipLocate).to.be.eq(1);

		httpClient.resetServiceCalls();

		// FIXME could be a source of potential bug; now it works due to fact that first day of next week is not calculated based on current day, but on current month
		//  tomorrow is calculated based on current day, but is not so harmful, maybe a process with had a higher delay because tomorrow is calculated with current time
		// 	adding a 1 sec sleep will cause test to fail, because computations are tied to current time

		// second instance detects that limit expired for ipstack and iplocate
		await secondGeoipInstance.locate('8.8.8.8');
		// @ts-ignore very unsafe, but we have to test this somehow
		expect(secondGeoipInstance.whenLimitsWillExpire.ipStack).to.be.eq(firstGeoipInstance.whenLimitsWillExpire.ipStack);
		// @ts-ignore very unsafe, but we have to test this somehow
		expect(secondGeoipInstance.whenLimitsWillExpire.ipLocate).to.be.eq(firstGeoipInstance.whenLimitsWillExpire.ipLocate);
		expect(httpClient.serviceCalls.ipStack).to.be.eq(1);
		expect(httpClient.serviceCalls.ipLocate).to.be.eq(1);
	});
});

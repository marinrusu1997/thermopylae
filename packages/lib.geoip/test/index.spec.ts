import type { ObjMap } from '@thermopylae/core.declarations';
import { load } from 'dotenv-extended';
import path, { dirname } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { GeoIpLiteRepository, GeoIpLocator, IpLocateRepository, type IpLocationsRepository, IpstackRepository, IpstackSubscriptionPlan } from '../lib/index.js';
import { IpRepositoryMock } from './mock/ip-repository.js';

describe('geoip spec', () => {
	const repositories = new Array<IpLocationsRepository>();

	beforeAll(() => {
		const environmentMap = load({ path: path.join(dirname(import.meta.dirname), '.env') });

		repositories.push(new GeoIpLiteRepository(1));
		repositories.push(
			new IpstackRepository({
				apiKey: environmentMap['IPSTACK_ACCESS_KEY']!,
				lang: 'en',
				plan: IpstackSubscriptionPlan.FREE,
				weight: 2,
				hooks: {
					onIpRetrievalError(err) {
						console.error('Failed to retrieve location from ipstack ', err);
					}
				}
			})
		);
		repositories.push(
			new IpLocateRepository({
				apiKey: environmentMap['IP_LOCATE_ACCESS_KEY'],
				weight: 3,
				hooks: {
					onIpRetrievalError(err) {
						console.error('Failed to retrieve location from iplocate ', err);
					},
					onRateLimitExceeded(rateLimitReset) {
						console.info('Iplocate Rate limit reset at ', rateLimitReset);
					}
				}
			})
		);
	});

	it('retrieves location', { timeout: 5000 }, async () => {
		const geoip = new GeoIpLocator(repositories);
		const ipToCountry = new Map<string, ObjMap>([
			[
				'8.8.8.8',
				{
					countryCode: ['US', undefined],
					regionCode: ['', 'CA', 'OH', null],
					city: ['', 'Mountain View', null, undefined],
					timezone: ['America/Chicago', null, undefined, ''],
					latitude: [37.751, 37.38801956176758, undefined, null],
					longitude: [-97.822, -122.07431030273438, undefined, null]
				}
			],
			[
				'1.1.1.1',
				{
					countryCode: ['AU', '', undefined],
					regionCode: ['', 'NSW', null, undefined],
					city: ['', 'Sydney', null, undefined],
					timezone: ['Australia/Sydney', null, undefined, ''],
					latitude: [-33.494, -33.86714172363281, undefined, null],
					longitude: [143.2104, 151.2071075439453, undefined, null]
				}
			],
			[
				'8.8.4.4',
				{
					countryCode: ['US', undefined],
					regionCode: ['', 'CA', null, undefined],
					city: ['', 'Mountain View', 'Glenmont', null, undefined],
					timezone: ['America/Chicago', null, undefined, ''],
					latitude: [37.751, 37.419158935546875, 37.38801956176758, undefined, null],
					longitude: [-97.822, -122.07540893554688, -122.07431030273438, undefined, null]
				}
			],
			[
				'139.130.4.5',
				{
					countryCode: ['AU', '', undefined],
					regionCode: ['WA', 'VIC', null, undefined],
					city: ['Broome', 'Melbourne', 'Balwyn North', 'Gold Coast', undefined],
					timezone: ['Australia/Perth', 'Australia/Melbourne', 'Australia/Brisbane', null, undefined, ''],
					latitude: [-17.9629, -37.81425094604492, -37.7907, undefined, null],
					longitude: [122.2387, 144.96316528320312, 145.0839, 122.232, undefined, null]
				}
			]
		]);

		for (const [ip, locationOptions] of ipToCountry) {
			const location = (await geoip.locate(ip))!;
			expect(locationOptions['countryCode']).to.include(location.countryCode);
			expect(locationOptions['regionCode']).to.include(location.regionCode);
			expect(locationOptions['city']).to.include(location.city);
			expect(locationOptions['timezone']).to.include(location.timezone);
			expect(locationOptions['latitude']).to.include(location.latitude);
			expect(locationOptions['longitude']).to.include(location.longitude);
		}
	});

	it('refresh local ip database in a fast manner (less than 400 ms)', async () => {
		const begin = new Date().getTime();
		await GeoIpLiteRepository.refresh();
		const end = new Date().getTime();
		expect(end - begin).to.be.lte(400);
	});

	it('retrieves location from specified repository', { timeout: 10000 }, async () => {
		const geoip = new GeoIpLocator(repositories);
		for (const repo of repositories) {
			const first = (await geoip.locate('8.8.8.8', repo.id))!;
			await setTimeout(1000);
			const second = await geoip.locate('8.8.8.8', first.REPOSITORY_ID);
			expect(first).to.be.deep.eq(second);
		}
	});

	it('returns null when no one repo can find location', async () => {
		const repo1 = new IpRepositoryMock(1);
		const repo2 = new IpRepositoryMock(2);
		const repo3 = new IpRepositoryMock(3);

		const geoip = new GeoIpLocator([repo1, repo2, repo3]);
		const location = await geoip.locate('127.0.0.1');

		expect(location).to.be.eq(null);
		expect(repo1.lookups).to.be.eq(1);
		expect(repo2.lookups).to.be.eq(1);
		expect(repo3.lookups).to.be.eq(1);
	});

	it('returns null when all repo are not available', async () => {
		const repo1 = new IpRepositoryMock(1);
		const repo2 = new IpRepositoryMock(2);
		const repo3 = new IpRepositoryMock(3);

		const geoip = new GeoIpLocator([repo1, repo2, repo3]);
		repo1.availability = false;
		repo2.availability = false;
		repo3.availability = false;

		const location = await geoip.locate('127.0.0.1');

		expect(location).to.be.eq(null);
		expect(repo1.lookups).to.be.eq(0);
		expect(repo2.lookups).to.be.eq(0);
		expect(repo3.lookups).to.be.eq(0);
	});

	it('returns null when no one repo can find location or are not available', async () => {
		const repo1 = new IpRepositoryMock(1);
		const repo2 = new IpRepositoryMock(2);
		const repo3 = new IpRepositoryMock(3);

		const geoip = new GeoIpLocator([repo1, repo2, repo3]);
		repo2.availability = false;

		const location = await geoip.locate('127.0.0.1');

		expect(location).to.be.eq(null);
		expect(repo1.lookups).to.be.eq(1);
		expect(repo2.lookups).to.be.eq(0);
		expect(repo3.lookups).to.be.eq(1);
	});

	it("when repo can't locate ip, fallbacks to another", async () => {
		const repo1 = new IpRepositoryMock(1);
		const repo2 = new IpRepositoryMock(10);
		const repo3 = new IpRepositoryMock(20);
		const geoip = new GeoIpLocator([repo1, repo2, repo3]);

		repo1.location = 'location';
		const location = await geoip.locate('127.0.0.1');

		expect(location).to.be.eq('location');
		expect(repo1.lookups).to.be.eq(1);
		expect(repo2.lookups).to.be.lte(1);
		expect(repo3.lookups).to.be.lte(1);
	});

	it("when repo isn't active, fallbacks to another", async () => {
		const repo1 = new IpRepositoryMock(1);
		const repo2 = new IpRepositoryMock(20);
		const repo3 = new IpRepositoryMock(30);
		const geoip = new GeoIpLocator([repo1, repo2, repo3]);

		repo1.location = 'location';
		repo2.availability = false;
		repo3.availability = false;

		const location = await geoip.locate('127.0.0.1');

		expect(location).to.be.eq('location');
		expect(repo1.lookups).to.be.eq(1);
		expect(repo2.lookups).to.be.lte(1);
		expect(repo3.lookups).to.be.lte(1);
	});
});

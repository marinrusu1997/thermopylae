import { describe, it, before } from 'mocha';
import { expect } from 'chai';
import { config as dotEnvConfig } from 'dotenv';
import { GeoIP } from '../lib';

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
	});

	it('retrieves location', async () => {
		const geoip = new GeoIP(ipstackAccessKey!);
		const location = await geoip.location('8.8.8.8');
		expect(location).not.to.be.eq(null);
		expect(location!.countryCode).to.be.eq('US');
		expect(location!.regionCode).to.be.oneOf(['CA', null]);
		expect(location!.city).to.be.eq('Mountain View');
		expect(location!.timeZone).to.be.oneOf(['America/Los_Angeles', null]);
		expect(location!.postalCode).to.be.eq('94041');
		expect(location!.latitude).to.be.eq(37.38801956176758);
		expect(location!.longitude).to.be.eq(-122.07431030273438);
	});

	it('refresh local ip database in a fast manner (less than 300 ms)', async () => {
		const begin = new Date().getTime();
		await GeoIP.refresh();
		const end = new Date().getTime();
		expect(end - begin).to.be.lte(300);
	});
});

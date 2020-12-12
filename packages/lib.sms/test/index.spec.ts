import { describe, it, before } from 'mocha';
import { config as loadConfigFromDotEnv } from 'dotenv';
import { chai } from './chai';
import { SmsClient, Options } from '../lib';

const { expect } = chai;

describe('SMS spec', () => {
	let config: Options;
	before(() => {
		const dotEnv = loadConfigFromDotEnv();
		if (dotEnv.error) {
			throw dotEnv.error;
		}
		config = {
			accountSid: process.env.ACCOUNT_SID!,
			authToken: process.env.AUTH_TOKEN!,
			fromNumber: '+12564108937'
		};
	});

	it('sends sms', async () => {
		const instance = new SmsClient(config);
		const id = await instance.send('+40771241038', 'Test');
		expect(typeof id).to.be.equal('string');
	});
});

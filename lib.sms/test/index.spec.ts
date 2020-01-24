import { describe, it, before } from 'mocha';
import { Exception } from '@marin/lib.error';
import { config as loadConfigFromDotEnv } from 'dotenv';
import { chai } from './chai';
import { SmsClient, Options, ErrorCodes } from '../lib';

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

	it('throws when already initialized', () => {
		const instance = new SmsClient();
		instance.init(config);
		expect(() => instance.init(config))
			.to.throw(Exception, '')
			.and.to.haveOwnProperty('code', ErrorCodes.SMS_CLIENT_ALREADY_INITIALIZED);
	});

	it('throws when sending sms and not initialized', async () => {
		const instance = new SmsClient();
		await expect(instance.send('', ''))
			.to.eventually.be.rejectedWith(Exception)
			.and.to.have.property('code', ErrorCodes.SMS_CLIENT_NOT_INITIALIZED);
	});

	it('sends sms', async () => {
		const instance = new SmsClient();
		instance.init(config);
		const id = await instance.send('+40771241038', 'Test');
		expect(id).to.not.equal(undefined);
	});
});

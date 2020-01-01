import { describe, it, before } from 'mocha';
import { Exception } from '@marin/lib.error';
import { config as loadConfigFromDotEnv } from 'dotenv';
import { chai } from './chai';
import { SMS } from '../lib/sms';

const { expect } = chai;

describe('SMS spec', () => {
	let config;
	before(() => {
		const dotEnv = loadConfigFromDotEnv();
		if (dotEnv.error) {
			throw dotEnv.error;
		}
		config = {
			accountSid: process.env.ACCOUNT_SID,
			authToken: process.env.AUTH_TOKEN,
			fromNumber: '+12564108937'
		};
	});

	it('throws when already initialized', () => {
		const instance = new SMS();
		instance.init(config);
		expect(() => instance.init(config)).to.throw(Exception, 'SMS system already intialized');
	});

	it('throws when sending sms and not initialized', async () => {
		const instance = new SMS();
		await expect(instance.send('', ''))
			.to.eventually.be.rejectedWith(Exception)
			.and.to.have.property('message', 'SMS system is not intialized');
	});

	it('sends sms', async () => {
		const instance = new SMS();
		instance.init(config);
		const id = await instance.send('+40771241038', 'Test');
		expect(id).to.not.equal(undefined);
	});
});

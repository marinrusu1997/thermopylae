import { describe, it } from 'mocha';
import { Exception } from '@marin/lib.error';
import { chai } from './chai';
import { SMS } from '../lib/sms';

const { expect } = chai;

describe('SMS spec', () => {
	it('throws when already initialized', () => {
		const instance = new SMS();
		instance.init({
			accountSid: 'AC392dc5f5462c1032dec7b8e40cb286ee',
			authToken: 'ed2bd9c6f9331139ba1a22c4a059a0fd',
			fromNumber: '+12564108937'
		});
		expect(() =>
			instance.init({
				accountSid: 'AC392dc5f5462c1032dec7b8e40cb286ee',
				authToken: 'ed2bd9c6f9331139ba1a22c4a059a0fd',
				fromNumber: '+12564108937'
			})
		).to.throw(Exception, 'SMS system already intialized');
	});

	it('throws when sending sms and not initialized', async () => {
		const instance = new SMS();
		await expect(instance.send('', ''))
			.to.eventually.be.rejectedWith(Exception)
			.and.to.have.property('message', 'SMS system is not intialized');
	});

	it('sends sms', async () => {
		const instance = new SMS();
		instance.init({
			accountSid: 'AC392dc5f5462c1032dec7b8e40cb286ee',
			authToken: 'ed2bd9c6f9331139ba1a22c4a059a0fd',
			fromNumber: '+12564108937'
		});
		const id = await instance.send('+40771241038', 'Test');
		expect(id).to.not.equal(undefined);
	});
});

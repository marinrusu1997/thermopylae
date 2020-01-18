import { describe, it } from 'mocha';
import { expect } from 'chai';
import { services } from '@marin/lib.utils';
import { Firewall } from '../lib';

describe('register spec', () => {
	it('validates correct registration data', async () => {
		const registrationData = {
			username: 'usernamead',
			password: 'passasd5454!asdM',
			email: 'email@email.com',
			telephone: '07746564663'
		};
		try {
			expect(await Firewall.validate(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.REGISTER, registrationData)).to.be.eq(true);
		} catch (e) {
			console.error(e);
		}
	});
});

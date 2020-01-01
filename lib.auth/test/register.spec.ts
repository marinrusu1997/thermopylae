import { describe, it } from 'mocha';
import { expect } from 'chai';
import { AuthService } from '../lib/service';
import basicAuthServiceConfig from './fixtures';

describe('Account registration spec', () => {
	const AuthServiceInstance = new AuthService({
		...basicAuthServiceConfig,
		ttl: {
			totp: 1, // sec
			activateAccountSession: 0.01, // in minutes -> 1 sec
			failedAuthAttemptsSession: 0.01, // in minutes -> 1 sec
			authSession: 0.01 // in minutes -> 1 sec
		},
		thresholds: {
			passwordBreach: 2,
			recaptcha: 2,
			maxFailedAuthAttempts: 3
		}
	});

	it('registers successfully new account', async () => {
		await AuthServiceInstance.register(
			{
				username: 'username',
				password: 'auirg7q85y1298huwityh289',
				email: 'user@product.com',
				telephone: '+568425666'
			},
			{
				isActivated: true
			}
		);
		expect(1).to.be.equal(1);
	});
});

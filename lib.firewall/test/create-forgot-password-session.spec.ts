import { describe, it } from 'mocha';
import { services } from '@marin/lib.utils';
import { generateString, testEnum, testPassesValidation, testRequired, testType } from './utils';
import { usernameTestsSuite } from './credentials-test-cases';

describe(`${services.SERVICES.AUTH}-${services.AUTH_SERVICE_METHODS.CREATE_FORGOT_PASSWORD_SESSION} spec`, () => {
	describe('username spec', () => {
		const data = { 'side-channel': 'SMS' };
		usernameTestsSuite(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.CREATE_FORGOT_PASSWORD_SESSION, data);
	});

	describe('side-channel spec', () => {
		it('is required', async () => {
			const data = {
				username: 'usernameee'
			};
			await testRequired(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.CREATE_FORGOT_PASSWORD_SESSION, data, '', 'side-channel');
		});

		it('is string', async () => {
			const data = {
				username: 'usernameee',
				'side-channel': 1
			};
			await testType(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.CREATE_FORGOT_PASSWORD_SESSION, data, "['side-channel']", 'string');
		});

		it('accepts only specified enum values', async () => {
			const data = {
				username: 'usernameee',
				'side-channel': 'EMAIL'
			};
			await testPassesValidation(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.CREATE_FORGOT_PASSWORD_SESSION, data);
		});

		it('rejects non enum values', async () => {
			const data = {
				username: 'usernameee',
				'side-channel': 'blah'
			};
			for (let i = 0; i < 10; i++) {
				data['side-channel'] = generateString(5);
				await testEnum(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.CREATE_FORGOT_PASSWORD_SESSION, data, "['side-channel']");
			}
		});
	});
});

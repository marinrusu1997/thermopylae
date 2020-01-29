import { describe, it } from 'mocha';
import { Services, AuthServiceMethods } from '@marin/declarations/services';
import { generateString, testEnum, testPassesValidation, testRequired, testType } from './utils';
import { usernameTestsSuite } from './test-cases/credentials-test-cases';

describe(`${Services.AUTH}-${AuthServiceMethods.CREATE_FORGOT_PASSWORD_SESSION} spec`, () => {
	describe('username spec', () => {
		const data = { 'side-channel': 'SMS' };
		usernameTestsSuite(Services.AUTH, AuthServiceMethods.CREATE_FORGOT_PASSWORD_SESSION, data);
	});

	describe('side-channel spec', () => {
		it('is required', async () => {
			const data = {
				username: 'usernameee'
			};
			await testRequired(Services.AUTH, AuthServiceMethods.CREATE_FORGOT_PASSWORD_SESSION, data, '', 'side-channel');
		});

		it('is string', async () => {
			const data = {
				username: 'usernameee',
				'side-channel': 1
			};
			await testType(Services.AUTH, AuthServiceMethods.CREATE_FORGOT_PASSWORD_SESSION, data, "['side-channel']", 'string');
		});

		it('accepts only specified enum values', async () => {
			const data = {
				username: 'usernameee',
				'side-channel': 'EMAIL'
			};
			await testPassesValidation(Services.AUTH, AuthServiceMethods.CREATE_FORGOT_PASSWORD_SESSION, data);
		});

		it('rejects non enum values', async () => {
			const data = {
				username: 'usernameee',
				'side-channel': 'blah'
			};
			for (let i = 0; i < 10; i++) {
				data['side-channel'] = generateString(5);
				await testEnum(Services.AUTH, AuthServiceMethods.CREATE_FORGOT_PASSWORD_SESSION, data, "['side-channel']");
			}
		});
	});
});

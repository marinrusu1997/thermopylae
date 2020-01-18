import { describe, it } from 'mocha';
import { services } from '@marin/lib.utils';
import { generateString, testMaxLength, testRequired, testType } from './utils';
import { passwordTestsSuite } from './credentials-test-cases';

describe(`${services.SERVICES.AUTH}-${services.AUTH_SERVICE_METHODS.CHANGE_FORGOTTEN_PASSWORD} spec`, () => {
	describe('token spec', () => {
		it('is required', async () => {
			const data = {};
			await testRequired(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.CHANGE_FORGOTTEN_PASSWORD, data, '', 'token');
		});

		it('is string', async () => {
			const data = {
				token: 1,
				newPassword: generateString(10)
			};
			await testType(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.CHANGE_FORGOTTEN_PASSWORD, data, '.token', 'string');
		});

		it('has max length of 20 chars', async () => {
			const data = {
				token: generateString(21),
				newPassword: generateString(10)
			};
			await testMaxLength(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.CHANGE_FORGOTTEN_PASSWORD, data, '.token', 20);
		});
	});

	describe('newPassword spec', () => {
		const data = {
			token: generateString(20)
		};
		passwordTestsSuite(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.CHANGE_FORGOTTEN_PASSWORD, data, 'newPassword');
	});
});

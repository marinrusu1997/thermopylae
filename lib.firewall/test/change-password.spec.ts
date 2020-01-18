import { describe, it } from 'mocha';
import { services } from '@marin/lib.utils';
import { generateString, testMaxLength, testRequired, testType } from './utils';
import { passwordTestsSuite } from './credentials-test-cases';

describe(`${services.SERVICES.AUTH}-${services.AUTH_SERVICE_METHODS.CHANGE_PASSWORD} spec`, () => {
	describe('sessionId spec', () => {
		it('is required', async () => {
			const data = {};
			await testRequired(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.CHANGE_PASSWORD, data, '', 'sessionId');
		});

		it('is string', async () => {
			const data = {
				sessionId: 1,
				oldPassword: generateString(10),
				newPassword: generateString(10)
			};
			await testType(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.CHANGE_PASSWORD, data, '.sessionId', 'string');
		});

		it('has max length of 20 chars', async () => {
			const data = {
				sessionId: generateString(21),
				oldPassword: generateString(10),
				newPassword: generateString(10)
			};
			await testMaxLength(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.CHANGE_PASSWORD, data, '.sessionId', 20);
		});
	});

	describe('oldPassword spec', () => {
		const data = {
			sessionId: generateString(20),
			newPassword: generateString(10)
		};
		passwordTestsSuite(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.CHANGE_PASSWORD, data, 'oldPassword');
	});

	describe('newPassword spec', () => {
		const data = {
			sessionId: generateString(20),
			oldPassword: generateString(10)
		};
		passwordTestsSuite(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.CHANGE_PASSWORD, data, 'newPassword');
	});
});

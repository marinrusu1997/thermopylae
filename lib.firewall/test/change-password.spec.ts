import { describe, it } from 'mocha';
// eslint-disable-next-line import/no-unresolved
import { Services, AuthServiceMethods } from '@marin/lib.utils/dist/enums';
import { generateString, testMaxLength, testRequired, testType } from './utils';
import { passwordTestsSuite } from './credentials-test-cases';

describe(`${Services.AUTH}-${AuthServiceMethods.CHANGE_PASSWORD} spec`, () => {
	describe('sessionId spec', () => {
		it('is required', async () => {
			const data = {};
			await testRequired(Services.AUTH, AuthServiceMethods.CHANGE_PASSWORD, data, '', 'sessionId');
		});

		it('is string', async () => {
			const data = {
				sessionId: 1,
				oldPassword: generateString(10),
				newPassword: generateString(10)
			};
			await testType(Services.AUTH, AuthServiceMethods.CHANGE_PASSWORD, data, '.sessionId', 'string');
		});

		it('has max length of 20 chars', async () => {
			const data = {
				sessionId: generateString(21),
				oldPassword: generateString(10),
				newPassword: generateString(10)
			};
			await testMaxLength(Services.AUTH, AuthServiceMethods.CHANGE_PASSWORD, data, '.sessionId', 20);
		});
	});

	describe('oldPassword spec', () => {
		const data = {
			sessionId: generateString(20),
			newPassword: generateString(10)
		};
		passwordTestsSuite(Services.AUTH, AuthServiceMethods.CHANGE_PASSWORD, data, 'oldPassword');
	});

	describe('newPassword spec', () => {
		const data = {
			sessionId: generateString(20),
			oldPassword: generateString(10)
		};
		passwordTestsSuite(Services.AUTH, AuthServiceMethods.CHANGE_PASSWORD, data, 'newPassword');
	});
});

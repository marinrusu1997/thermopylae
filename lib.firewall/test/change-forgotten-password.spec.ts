import { describe, it } from 'mocha';
// eslint-disable-next-line import/no-unresolved
import { Services, AuthServiceMethods } from '@marin/lib.utils/dist/enums';
import { generateString, testMaxLength, testRequired, testType } from './utils';
import { passwordTestsSuite } from './credentials-test-cases';

describe(`${Services.AUTH}-${AuthServiceMethods.CHANGE_FORGOTTEN_PASSWORD} spec`, () => {
	describe('token spec', () => {
		it('is required', async () => {
			const data = {};
			await testRequired(Services.AUTH, AuthServiceMethods.CHANGE_FORGOTTEN_PASSWORD, data, '', 'token');
		});

		it('is string', async () => {
			const data = {
				token: 1,
				newPassword: generateString(10)
			};
			await testType(Services.AUTH, AuthServiceMethods.CHANGE_FORGOTTEN_PASSWORD, data, '.token', 'string');
		});

		it('has max length of 20 chars', async () => {
			const data = {
				token: generateString(21),
				newPassword: generateString(10)
			};
			await testMaxLength(Services.AUTH, AuthServiceMethods.CHANGE_FORGOTTEN_PASSWORD, data, '.token', 20);
		});
	});

	describe('newPassword spec', () => {
		const data = {
			token: generateString(20)
		};
		passwordTestsSuite(Services.AUTH, AuthServiceMethods.CHANGE_FORGOTTEN_PASSWORD, data, 'newPassword');
	});
});

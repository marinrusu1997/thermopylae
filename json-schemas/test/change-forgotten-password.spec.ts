import { describe } from 'mocha';
import { Services, AuthServiceMethods } from '@marin/declarations/services';
import { generateString } from './utils';
import { passwordTestsSuite } from './test-cases/credentials-test-cases';
import { tokenTestSuite } from './test-cases/core-test-cases';

describe(`${Services.AUTH}-${AuthServiceMethods.CHANGE_FORGOTTEN_PASSWORD} spec`, () => {
	const serviceSpecificData = {
		newPassword: generateString(10)
	};

	tokenTestSuite(Services.AUTH, AuthServiceMethods.CHANGE_FORGOTTEN_PASSWORD, serviceSpecificData, 'token');

	describe('newPassword spec', () => {
		const data = {
			token: generateString(20, /[a-f0-9]/)
		};
		passwordTestsSuite(Services.AUTH, AuthServiceMethods.CHANGE_FORGOTTEN_PASSWORD, data, 'newPassword');
	});
});

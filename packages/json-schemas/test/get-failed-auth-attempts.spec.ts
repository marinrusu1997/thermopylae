import { describe, it } from 'mocha';
import { AuthServiceMethods, Services } from '@marin/declarations/lib/services';
import { generateString, testMinValue, testPassesValidation, testType } from './utils';
import { idTestSuite } from './test-cases/core-test-cases';

describe(`${Services.AUTH}-${AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS} spec`, () => {
	idTestSuite(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, {}, 'accountId');

	describe('startingFrom spec', () => {
		it('is not required', async () => {
			const data = {
				accountId: generateString(5)
			};
			await testPassesValidation(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, data);
		});

		it('is integer', async () => {
			const data = {
				startingFrom: 'today',
				accountId: generateString(50)
			};
			await testType(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, data, '.startingFrom', 'integer');
		});

		it('has min val of 0', async () => {
			const data = {
				startingFrom: -1,
				accountId: generateString(50)
			};
			await testMinValue(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, data, '.startingFrom', 0);
		});
	});

	describe('endingTo spec', () => {
		it('is not required', async () => {
			const data = {
				accountId: generateString(5)
			};
			await testPassesValidation(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, data);
		});

		it('is integer', async () => {
			const data = {
				endingTo: 'today',
				accountId: generateString(50)
			};
			await testType(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, data, '.endingTo', 'integer');
		});

		it('has min val of 0', async () => {
			const data = {
				endingTo: -1,
				accountId: generateString(50)
			};
			await testMinValue(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, data, '.endingTo', 0);
		});
	});
});

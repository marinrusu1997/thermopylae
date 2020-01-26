import { describe, it } from 'mocha';
// eslint-disable-next-line import/no-unresolved
import { AuthServiceMethods, Services } from '@marin/lib.utils/dist/enums';
import { string } from '@marin/lib.utils';
import { testMaxLength, testMinLength, testMinValue, testPassesValidation, testRequired, testType } from './utils';

describe(`${Services.AUTH}-${AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS} spec`, () => {
	describe('accountId spec', () => {
		it('is required', async () => {
			const data = {};
			await testRequired(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, data, '', 'accountId');
		});

		it('is string', async () => {
			const data = { accountId: 1 };
			await testType(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, data, '.accountId', 'string');
		});

		it('has min length of 5 chars', async () => {
			const data = { accountId: string.generateString(4) };
			await testMinLength(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, data, '.accountId', 5);
		});

		it('has max length of 50 chars', async () => {
			const data = { accountId: string.generateString(51) };
			await testMaxLength(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, data, '.accountId', 50);
		});
	});

	describe('startingFrom spec', () => {
		it('is not required', async () => {
			const data = {
				accountId: string.generateString(5)
			};
			await testPassesValidation(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, data);
		});

		it('is integer', async () => {
			const data = {
				startingFrom: 'today',
				accountId: string.generateString(50)
			};
			await testType(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, data, '.startingFrom', 'integer');
		});

		it('has min val of 0', async () => {
			const data = {
				startingFrom: -1,
				accountId: string.generateString(50)
			};
			await testMinValue(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, data, '.startingFrom', 0);
		});
	});

	describe('endingTo spec', () => {
		it('is not required', async () => {
			const data = {
				accountId: string.generateString(5)
			};
			await testPassesValidation(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, data);
		});

		it('is integer', async () => {
			const data = {
				endingTo: 'today',
				accountId: string.generateString(50)
			};
			await testType(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, data, '.endingTo', 'integer');
		});

		it('has min val of 0', async () => {
			const data = {
				endingTo: -1,
				accountId: string.generateString(50)
			};
			await testMinValue(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, data, '.endingTo', 0);
		});
	});
});

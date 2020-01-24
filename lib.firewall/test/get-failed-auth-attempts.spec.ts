import { describe, it } from 'mocha';
// eslint-disable-next-line import/no-unresolved
import { Services, AuthServiceMethods } from '@marin/lib.utils/dist/enums';
import { testMinValue, testPassesValidation, testType } from './utils';

describe(`${Services.AUTH}-${AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS} spec`, () => {
	describe('startingFrom spec', () => {
		it('is not required', async () => {
			const data = {};
			await testPassesValidation(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, data);
		});

		it('is integer', async () => {
			const data = { startingFrom: 'today' };
			await testType(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, data, '.startingFrom', 'integer');
		});

		it('has min val of 0', async () => {
			const data = { startingFrom: -1 };
			await testMinValue(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, data, '.startingFrom', 0);
		});
	});

	describe('endingTo spec', () => {
		it('is not required', async () => {
			const data = {};
			await testPassesValidation(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, data);
		});

		it('is integer', async () => {
			const data = { endingTo: 'today' };
			await testType(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, data, '.endingTo', 'integer');
		});

		it('has min val of 0', async () => {
			const data = { endingTo: -1 };
			await testMinValue(Services.AUTH, AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, data, '.endingTo', 0);
		});
	});
});

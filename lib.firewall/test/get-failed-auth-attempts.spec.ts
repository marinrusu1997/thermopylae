import { describe, it } from 'mocha';
import { services } from '@marin/lib.utils';
import { testMinValue, testPassesValidation, testType } from './utils';

describe(`${services.SERVICES.AUTH}-${services.AUTH_SERVICE_METHODS.GET_FAILED_AUTH_ATTEMPTS} spec`, () => {
	describe('startingFrom spec', () => {
		it('is not required', async () => {
			const data = {};
			await testPassesValidation(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.GET_FAILED_AUTH_ATTEMPTS, data);
		});

		it('is integer', async () => {
			const data = { startingFrom: 'today' };
			await testType(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.GET_FAILED_AUTH_ATTEMPTS, data, '.startingFrom', 'integer');
		});

		it('has min val of 0', async () => {
			const data = { startingFrom: -1 };
			await testMinValue(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.GET_FAILED_AUTH_ATTEMPTS, data, '.startingFrom', 0);
		});
	});

	describe('endingTo spec', () => {
		it('is not required', async () => {
			const data = {};
			await testPassesValidation(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.GET_FAILED_AUTH_ATTEMPTS, data);
		});

		it('is integer', async () => {
			const data = { endingTo: 'today' };
			await testType(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.GET_FAILED_AUTH_ATTEMPTS, data, '.endingTo', 'integer');
		});

		it('has min val of 0', async () => {
			const data = { endingTo: -1 };
			await testMinValue(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.GET_FAILED_AUTH_ATTEMPTS, data, '.endingTo', 0);
		});
	});
});

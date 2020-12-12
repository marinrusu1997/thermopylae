import { describe, it } from 'mocha';
import { AuthServiceMethods, Services } from '@marin/declarations/lib/services';
import { MultiFactorAuthenticationStatus } from '@marin/declarations/lib/auth';
import { generateString, testEnum, testPassesValidation, testRequired } from './utils';
import { idTestSuite } from './test-cases/core-test-cases';

describe(`${Services.AUTH}-${AuthServiceMethods.CHANGE_MULTI_FACTOR_AUTHENTICATION_STATUS} spec`, () => {
	idTestSuite(
		Services.AUTH,
		AuthServiceMethods.CHANGE_MULTI_FACTOR_AUTHENTICATION_STATUS,
		{
			status: MultiFactorAuthenticationStatus.ENABLED
		},
		'accountId'
	);

	describe('status spec', () => {
		it('is required', async () => {
			const data = {};
			await testRequired(Services.AUTH, AuthServiceMethods.CHANGE_MULTI_FACTOR_AUTHENTICATION_STATUS, data, '', 'status');
		});

		it('does not support other values than predefined enum ones', async () => {
			const data = {
				status: 'true'
			};
			await testEnum(Services.AUTH, AuthServiceMethods.CHANGE_MULTI_FACTOR_AUTHENTICATION_STATUS, data, '.status');
		});
	});

	it('supports additional properties', async () => {
		const data = {
			status: MultiFactorAuthenticationStatus.DISABLED,
			accountId: generateString(50),
			additional: 'property'
		};
		await testPassesValidation(Services.AUTH, AuthServiceMethods.CHANGE_MULTI_FACTOR_AUTHENTICATION_STATUS, data);
	});

	it('validates against correct data where status is disabled', async () => {
		const data = {
			status: MultiFactorAuthenticationStatus.DISABLED,
			accountId: generateString(50)
		};
		await testPassesValidation(Services.AUTH, AuthServiceMethods.CHANGE_MULTI_FACTOR_AUTHENTICATION_STATUS, data);
	});

	it('validates against correct data where status is enabled', async () => {
		const data = {
			status: MultiFactorAuthenticationStatus.ENABLED,
			accountId: generateString(10)
		};
		await testPassesValidation(Services.AUTH, AuthServiceMethods.CHANGE_MULTI_FACTOR_AUTHENTICATION_STATUS, data);
	});
});

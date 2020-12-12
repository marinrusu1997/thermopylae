import { describe, it } from 'mocha';
import { AuthServiceMethods, Services } from '@marin/declarations/lib/services';
import { AccountStatus } from '@marin/declarations/lib/auth';
import { generateString, testEnum, testMaxLength, testMinLength, testPassesValidation, testRequired, testType } from './utils';
import { idTestSuite } from './test-cases/core-test-cases';

describe(`${Services.AUTH}-${AuthServiceMethods.CHANGE_ACCOUNT_STATUS} spec`, () => {
	idTestSuite(
		Services.AUTH,
		AuthServiceMethods.CHANGE_ACCOUNT_STATUS,
		{
			status: AccountStatus.ENABLED
		},
		'accountId'
	);

	describe('status spec', () => {
		it('is required', async () => {
			const data = {};
			await testRequired(Services.AUTH, AuthServiceMethods.CHANGE_ACCOUNT_STATUS, data, '', 'status');
		});

		it('does not support other values than predefined enum ones', async () => {
			const data = {
				status: 'true'
			};
			await testEnum(Services.AUTH, AuthServiceMethods.CHANGE_ACCOUNT_STATUS, data, '.status');
		});
	});

	describe('cause spec', () => {
		it('is string', async () => {
			const data = {
				status: AccountStatus.DISABLED,
				accountId: generateString(50),
				cause: 12
			};
			await testType(Services.AUTH, AuthServiceMethods.CHANGE_ACCOUNT_STATUS, data, '.cause', 'string');
		});

		it('has min length of 10', async () => {
			const data = {
				status: AccountStatus.DISABLED,
				accountId: generateString(50),
				cause: generateString(9)
			};
			await testMinLength(Services.AUTH, AuthServiceMethods.CHANGE_ACCOUNT_STATUS, data, '.cause', 10);
		});

		it('has max length of 200', async () => {
			const data = {
				status: AccountStatus.DISABLED,
				accountId: generateString(50),
				cause: generateString(201)
			};
			await testMaxLength(Services.AUTH, AuthServiceMethods.CHANGE_ACCOUNT_STATUS, data, '.cause', 200);
		});

		it('is required when status is disabled', async () => {
			const data = {
				status: AccountStatus.DISABLED,
				accountId: generateString(5)
			};
			await testRequired(Services.AUTH, AuthServiceMethods.CHANGE_ACCOUNT_STATUS, data, '', '.cause');
		});

		it('is not required when status is enabled', async () => {
			const data = {
				status: AccountStatus.ENABLED,
				accountId: generateString(5)
			};
			await testPassesValidation(Services.AUTH, AuthServiceMethods.CHANGE_ACCOUNT_STATUS, data);
		});
	});

	it('supports additional properties', async () => {
		const data = {
			status: AccountStatus.DISABLED,
			accountId: generateString(50),
			cause: generateString(10),
			additional: 'property'
		};
		await testPassesValidation(Services.AUTH, AuthServiceMethods.CHANGE_ACCOUNT_STATUS, data);
	});

	it('validates against correct data where status is disabled', async () => {
		const data = {
			status: AccountStatus.DISABLED,
			cause: generateString(10),
			accountId: generateString(50)
		};
		await testPassesValidation(Services.AUTH, AuthServiceMethods.CHANGE_ACCOUNT_STATUS, data);
	});

	it('validates against correct data where status is enabled', async () => {
		const data = {
			status: AccountStatus.ENABLED,
			accountId: generateString(10)
		};
		await testPassesValidation(Services.AUTH, AuthServiceMethods.CHANGE_ACCOUNT_STATUS, data);
	});
});

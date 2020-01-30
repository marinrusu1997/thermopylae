import { describe, it } from 'mocha';
import { AuthServiceMethods, Services } from '@marin/declarations/lib/services';
import { string } from '@marin/lib.utils';
import { testAdditionalProperties, testMaxLength, testMinLength, testPassesValidation, testRequired, testType } from './utils';
import { idTestSuite } from './test-cases/core-test-cases';

describe(`${Services.AUTH}-${AuthServiceMethods.CHANGE_ACCOUNT_LOCK_STATUS} spec`, () => {
	idTestSuite(
		Services.AUTH,
		AuthServiceMethods.CHANGE_ACCOUNT_LOCK_STATUS,
		{
			enable: false
		},
		'accountId'
	);

	describe('enable spec', () => {
		it('is boolean', async () => {
			const data = {
				enable: 'true'
			};
			await testType(Services.AUTH, AuthServiceMethods.CHANGE_ACCOUNT_LOCK_STATUS, data, '.enable', 'boolean');
		});

		it('is required', async () => {
			const data = {};
			await testRequired(Services.AUTH, AuthServiceMethods.CHANGE_ACCOUNT_LOCK_STATUS, data, '', 'enable');
		});
	});

	describe('cause spec', () => {
		it('is required when lock is enabled', async () => {
			const data = {
				enable: true,
				accountId: string.generateString(5)
			};
			await testRequired(Services.AUTH, AuthServiceMethods.CHANGE_ACCOUNT_LOCK_STATUS, data, '', '.cause');
		});

		it('is not required when lock is disabled', async () => {
			const data = {
				enable: false,
				accountId: string.generateString(5)
			};
			await testPassesValidation(Services.AUTH, AuthServiceMethods.CHANGE_ACCOUNT_LOCK_STATUS, data);
		});

		it('is string', async () => {
			const data = {
				enable: false,
				accountId: string.generateString(50),
				cause: 12
			};
			await testType(Services.AUTH, AuthServiceMethods.CHANGE_ACCOUNT_LOCK_STATUS, data, '.cause', 'string');
		});

		it('has min length of 10', async () => {
			const data = {
				enable: true,
				accountId: string.generateString(50),
				cause: string.generateString(9)
			};
			await testMinLength(Services.AUTH, AuthServiceMethods.CHANGE_ACCOUNT_LOCK_STATUS, data, '.cause', 10);
		});

		it('has max length of 200', async () => {
			const data = {
				enable: false,
				accountId: string.generateString(50),
				cause: string.generateString(201)
			};
			await testMaxLength(Services.AUTH, AuthServiceMethods.CHANGE_ACCOUNT_LOCK_STATUS, data, '.cause', 200);
		});
	});

	it("doesn't support additional properties", async () => {
		const data = {
			enable: true,
			accountId: string.generateString(50),
			cause: string.generateString(10),
			additional: 'property'
		};
		await testAdditionalProperties(Services.AUTH, AuthServiceMethods.CHANGE_ACCOUNT_LOCK_STATUS, data);
	});

	it('validates against correct data where lock is enabled', async () => {
		const data = {
			enable: true,
			cause: string.generateString(10),
			accountId: string.generateString(50)
		};
		await testPassesValidation(Services.AUTH, AuthServiceMethods.CHANGE_ACCOUNT_LOCK_STATUS, data);
	});

	it('validates against correct data where lock is not enabled', async () => {
		const data = {
			enable: false,
			accountId: string.generateString(10)
		};
		await testPassesValidation(Services.AUTH, AuthServiceMethods.CHANGE_ACCOUNT_LOCK_STATUS, data);
	});
});

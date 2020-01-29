import { describe, it } from 'mocha';
import { Services, AuthServiceMethods } from '@marin/declarations/services';
import { passwordTestsSuite, usernameTestsSuite } from './test-cases/credentials-test-cases';
import { idTestSuite } from './test-cases/core-test-cases';
import { generateString, testAdditionalProperties } from './utils';

describe(`${Services.AUTH}-${AuthServiceMethods.VALIDATE_ACCOUNT_CREDENTIALS} spec`, () => {
	idTestSuite(Services.AUTH, AuthServiceMethods.VALIDATE_ACCOUNT_CREDENTIALS, { username: 'username', password: 'password' }, 'accountId');
	usernameTestsSuite(Services.AUTH, AuthServiceMethods.VALIDATE_ACCOUNT_CREDENTIALS, { accountId: 'accountId' });
	passwordTestsSuite(Services.AUTH, AuthServiceMethods.VALIDATE_ACCOUNT_CREDENTIALS, { accountId: 'accountId', username: 'validusername' });

	it('additional properties are not allowed', async () => {
		const data = {
			accountId: generateString(10, /[a-f0-9]/),
			username: generateString(10, /[a-zA-Z0-9]/),
			password: generateString(10),
			additional: 'property'
		};
		await testAdditionalProperties(Services.AUTH, AuthServiceMethods.VALIDATE_ACCOUNT_CREDENTIALS, data);
	});
});

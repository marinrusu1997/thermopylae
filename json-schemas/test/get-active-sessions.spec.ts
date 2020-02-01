import { describe, it } from 'mocha';
import { Services, AuthServiceMethods } from '@marin/declarations/lib/services';
import { idTestSuite } from './test-cases/core-test-cases';
import { generateString, testAdditionalProperties } from './utils';

describe(`${Services.AUTH}-${AuthServiceMethods.GET_ACTIVE_SESSIONS} spec`, () => {
	idTestSuite(Services.AUTH, AuthServiceMethods.GET_ACTIVE_SESSIONS, {}, 'accountId');

	it('additional properties are not allowed', async () => {
		const data = {
			accountId: generateString(10, /[a-f0-9]/),
			additional: 'property'
		};
		await testAdditionalProperties(Services.AUTH, AuthServiceMethods.GET_ACTIVE_SESSIONS, data);
	});
});

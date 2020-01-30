import { describe } from 'mocha';
import { Services, AuthServiceMethods } from '@marin/declarations/lib/services';
import { tokenTestSuite } from './test-cases/core-test-cases';

describe(`${Services.AUTH}-${AuthServiceMethods.ACTIVATE_ACCOUNT} spec`, () => {
	tokenTestSuite(Services.AUTH, AuthServiceMethods.ACTIVATE_ACCOUNT, {}, 'activateAccountToken');
});

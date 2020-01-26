import { describe } from 'mocha';
// eslint-disable-next-line import/no-unresolved
import { Services, AuthServiceMethods } from '@marin/lib.utils/dist/enums';
import { tokenTestSuite } from './test-cases/core-test-cases';

describe(`${Services.AUTH}-${AuthServiceMethods.ACTIVATE_ACCOUNT} spec`, () => {
	tokenTestSuite(Services.AUTH, AuthServiceMethods.ACTIVATE_ACCOUNT, {}, 'activateAccountToken');
});

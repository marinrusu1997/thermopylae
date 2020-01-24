import { describe } from 'mocha';
// eslint-disable-next-line import/no-unresolved
import { Services, AuthServiceMethods } from '@marin/lib.utils/dist/enums';
import { passwordTestsSuite, usernameTestsSuite } from './credentials-test-cases';

describe(`${Services.AUTH}-${AuthServiceMethods.VALIDATE_ACCOUNT_CREDENTIALS} spec`, () => {
	usernameTestsSuite(Services.AUTH, AuthServiceMethods.VALIDATE_ACCOUNT_CREDENTIALS, {});
	passwordTestsSuite(Services.AUTH, AuthServiceMethods.VALIDATE_ACCOUNT_CREDENTIALS, {});
});

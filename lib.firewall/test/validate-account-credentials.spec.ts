import { describe } from 'mocha';
import { services } from '@marin/lib.utils';
import { passwordTestsSuite, usernameTestsSuite } from './credentials-test-cases';

describe(`${services.SERVICES.AUTH}-${services.AUTH_SERVICE_METHODS.VALIDATE_ACCOUNT_CREDENTIALS} spec`, () => {
	usernameTestsSuite(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.VALIDATE_ACCOUNT_CREDENTIALS, {});
	passwordTestsSuite(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.VALIDATE_ACCOUNT_CREDENTIALS, {});
});

import { describe, it } from 'mocha';
import { services } from '@marin/lib.utils';
import { generateString, testPattern, testRequired } from './utils';

describe(`${services.SERVICES.AUTH}-${services.AUTH_SERVICE_METHODS.ACTIVATE_ACCOUNT} spec`, () => {
	describe('activateAccountToken spec', () => {
		it('is required', async () => {
			const data = {};
			await testRequired(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.ACTIVATE_ACCOUNT, data, '', 'activateAccountToken');
		});

		it("can't have less than 20 chars", async () => {
			const data = {
				activateAccountToken: generateString(19, /^[0-9a-zA-Z]$/)
			};
			await testPattern(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.ACTIVATE_ACCOUNT, data, '.activateAccountToken', '^[a-zA-Z0-9]{20}$');
		});

		it("can't have more than 20 chars", async () => {
			const data = {
				activateAccountToken: generateString(21, /^[0-9a-zA-Z]$/)
			};
			await testPattern(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.ACTIVATE_ACCOUNT, data, '.activateAccountToken', '^[a-zA-Z0-9]{20}$');
		});

		it("can't contain special characters", async () => {
			const data = {
				activateAccountToken: generateString(20, /^[!]$/)
			};
			await testPattern(services.SERVICES.AUTH, services.AUTH_SERVICE_METHODS.ACTIVATE_ACCOUNT, data, '.activateAccountToken', '^[a-zA-Z0-9]{20}$');
		});
	});
});

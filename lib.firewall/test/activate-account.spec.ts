import { describe, it } from 'mocha';
// eslint-disable-next-line import/no-unresolved
import { Services, AuthServiceMethods } from '@marin/lib.utils/dist/enums';
import { generateString, testPattern, testRequired } from './utils';

describe(`${Services.AUTH}-${AuthServiceMethods.ACTIVATE_ACCOUNT} spec`, () => {
	describe('activateAccountToken spec', () => {
		it('is required', async () => {
			const data = {};
			await testRequired(Services.AUTH, AuthServiceMethods.ACTIVATE_ACCOUNT, data, '', 'activateAccountToken');
		});

		it("can't have less than 20 chars", async () => {
			const data = {
				activateAccountToken: generateString(19, /^[0-9a-zA-Z]$/)
			};
			await testPattern(Services.AUTH, AuthServiceMethods.ACTIVATE_ACCOUNT, data, '.activateAccountToken', '^[a-zA-Z0-9]{20}$');
		});

		it("can't have more than 20 chars", async () => {
			const data = {
				activateAccountToken: generateString(21, /^[0-9a-zA-Z]$/)
			};
			await testPattern(Services.AUTH, AuthServiceMethods.ACTIVATE_ACCOUNT, data, '.activateAccountToken', '^[a-zA-Z0-9]{20}$');
		});

		it("can't contain special characters", async () => {
			const data = {
				activateAccountToken: generateString(20, /^[!]$/)
			};
			await testPattern(Services.AUTH, AuthServiceMethods.ACTIVATE_ACCOUNT, data, '.activateAccountToken', '^[a-zA-Z0-9]{20}$');
		});
	});
});

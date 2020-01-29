import { describe, it } from 'mocha';
import { expect } from 'chai';
import { AuthServiceMethods, Services } from '@marin/declarations/services';
import { Firewall } from '@marin/lib.firewall';
import { generateString, testAdditionalProperties, testType } from './utils';
import { passwordTestsSuite } from './test-cases/credentials-test-cases';

describe(`${Services.AUTH}-${AuthServiceMethods.CHANGE_PASSWORD} spec`, () => {
	describe('old password spec', () => {
		const data = {
			new: generateString(10)
		};
		passwordTestsSuite(Services.AUTH, AuthServiceMethods.CHANGE_PASSWORD, data, 'old');
	});

	describe('new password spec', () => {
		const data = {
			old: generateString(10)
		};
		passwordTestsSuite(Services.AUTH, AuthServiceMethods.CHANGE_PASSWORD, data, 'new');
	});

	describe('log all other sessions out spec', () => {
		it('is not required', async () => {
			const data = {
				old: generateString(10),
				new: generateString(10)
			};
			expect(await Firewall.validate(Services.AUTH, AuthServiceMethods.CHANGE_PASSWORD, data)).to.be.deep.eq(data);
		});

		it('is a boolean', async () => {
			const data = {
				old: generateString(10),
				new: generateString(10),
				logAllOtherSessionsOut: 'true'
			};
			await testType(Services.AUTH, AuthServiceMethods.CHANGE_PASSWORD, data, '.logAllOtherSessionsOut', 'boolean');
		});
	});

	it('does not support additional properties', async () => {
		const data = {
			old: generateString(10),
			new: generateString(10),
			additional: 'property'
		};
		await testAdditionalProperties(Services.AUTH, AuthServiceMethods.CHANGE_PASSWORD, data);
	});
});

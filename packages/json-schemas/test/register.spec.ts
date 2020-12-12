import { describe, it } from 'mocha';
import { expect } from 'chai';
import { AuthServiceMethods, Services } from '@marin/declarations/lib/services';
import { Firewall } from '@marin/lib.firewall';
import { passwordTestsSuite, usernameTestsSuite } from './test-cases/credentials-test-cases';
import { generateString, testAdditionalProperties, testEnum, testMaxLength, testRequired, testType } from './utils';
import { emailTestSuite, telephoneTestSuite } from './test-cases/core-test-cases';

describe(`${Services.AUTH}-${AuthServiceMethods.REGISTER} spec`, () => {
	const registrationInfo = {
		email: 'email@email.com',
		telephone: '+437746564663',
		role: 'USER'
	};

	const validCredentials = {
		username: 'validpassword',
		password: '!@45Masdasdidgh'
	};

	const serviceMethodSpecificData = {
		...validCredentials,
		...registrationInfo
	};

	describe('credentials spec', () => {
		usernameTestsSuite(Services.AUTH, AuthServiceMethods.REGISTER, registrationInfo);
		passwordTestsSuite(Services.AUTH, AuthServiceMethods.REGISTER, { ...registrationInfo, username: 'validusername' });
	});

	emailTestSuite(Services.AUTH, AuthServiceMethods.REGISTER, serviceMethodSpecificData, 'email');

	telephoneTestSuite(Services.AUTH, AuthServiceMethods.REGISTER, serviceMethodSpecificData, 'telephone');

	describe('role spec', () => {
		it('is required', async () => {
			const data = {
				...validCredentials,
				...registrationInfo,
				role: undefined
			};
			await testRequired(Services.AUTH, AuthServiceMethods.REGISTER, data, '', 'role');
		});

		it('should be equal to one of the allowed values', async () => {
			const data = {
				...validCredentials,
				...registrationInfo,
				role: generateString(5)
			};
			await testEnum(Services.AUTH, AuthServiceMethods.REGISTER, data, '.role');
		});

		it('accepts only USER as role', async () => {
			const data = {
				...validCredentials,
				...registrationInfo,
				role: 'USER'
			};
			expect(await Firewall.validate(Services.AUTH, AuthServiceMethods.REGISTER, data)).to.be.deep.eq(data);
		});
	});

	describe('pubKey spec', () => {
		it('is not required', async () => {
			const data = {
				...validCredentials,
				...registrationInfo
			};
			expect(await Firewall.validate(Services.AUTH, AuthServiceMethods.REGISTER, data)).to.be.deep.eq(data);
		});

		it('needs to have max length of 540', async () => {
			const data = {
				...validCredentials,
				...registrationInfo,
				pubKey: generateString(541)
			};
			await testMaxLength(Services.AUTH, AuthServiceMethods.REGISTER, data, '.pubKey', 540);
		});
	});

	describe('enableMultiFactorAuth spec', () => {
		it('is not required', async () => {
			const data = {
				...validCredentials,
				...registrationInfo
			};
			expect(await Firewall.validate(Services.AUTH, AuthServiceMethods.REGISTER, data)).to.be.deep.eq(data);
		});

		it('needs to be a boolean', async () => {
			const data = {
				...validCredentials,
				...registrationInfo,
				enableMultiFactorAuth: 'true'
			};
			await testType(Services.AUTH, AuthServiceMethods.REGISTER, data, '.enableMultiFactorAuth', 'boolean');
		});
	});

	it("can't contain additional properties", () => {
		const registrationData = {
			...validCredentials,
			...registrationInfo,
			additional: 'property'
		};
		testAdditionalProperties(Services.AUTH, AuthServiceMethods.REGISTER, registrationData);
	});

	it('correct registration date passes validation', async () => {
		const registrationData = {
			...validCredentials,
			...registrationInfo,
			role: 'USER',
			pubKey: generateString(540)
		};
		expect(await Firewall.validate(Services.AUTH, AuthServiceMethods.REGISTER, registrationData)).to.be.deep.eq(registrationData);
	});
});

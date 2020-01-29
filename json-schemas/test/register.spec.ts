import { describe, it } from 'mocha';
import { expect } from 'chai';
import { AuthServiceMethods, Services } from '@marin/declarations/services';
import { Firewall } from '@marin/lib.firewall';
import { passwordTestsSuite, usernameTestsSuite } from './test-cases/credentials-test-cases';
import { generateString, testAdditionalProperties, testEnum, testFormat, testMaxLength, testPattern, testRequired, testType } from './utils';

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

	describe('credentials spec', () => {
		usernameTestsSuite(Services.AUTH, AuthServiceMethods.REGISTER, registrationInfo);
		passwordTestsSuite(Services.AUTH, AuthServiceMethods.REGISTER, { ...registrationInfo, username: 'validusername' });
	});

	describe('email spec', () => {
		it('is required', async () => {
			const data = {
				...validCredentials,
				...registrationInfo
			};
			delete data.email;
			await testRequired(Services.AUTH, AuthServiceMethods.REGISTER, data, '', 'email');
		});

		it("can't exceed max length of 254", async () => {
			const data = {
				...validCredentials,
				...registrationInfo,
				email: generateString(255)
			};
			await testMaxLength(Services.AUTH, AuthServiceMethods.REGISTER, data, '.email', 254);
		});

		it('rejects invalid email format', async () => {
			const invalidEmails = [
				'plainaddress',
				'#@%^%#$@#$@#.com',
				'@example.com',
				'Joe Smith <email@example.com>',
				'email.example.com',
				'email@example@example.com',
				'あいうえお@example.com',
				'email@example.com (Joe Smith)',
				'email@-example.com',
				'email@example..com',
				'email@[123.123.123.123]',
				'"email"@example.com',
				'”(),:;<>[\\]@example.com',
				'just”not”right@example.com',
				'this\\ is"really"not\\allowed@example.com',
				'very.unusual.”@”.unusual.com@example.com',
				'very.”(),:;<>[]”.VERY.”very@\\\\ "very”.unusual@strange.example.com',
				'much.”more\\ unusual”@example.com'
			];

			for (let i = 0; i < invalidEmails.length; i++) {
				const data = {
					...validCredentials,
					...registrationInfo,
					email: invalidEmails[i]
				};
				await testFormat(Services.AUTH, AuthServiceMethods.REGISTER, data, '.email', 'email');
			}
		});

		it('accepts valid email format', async () => {
			const validEmails = [
				'email@example.com',
				'firstname.lastname@example.com',
				'email@subdomain.example.com',
				'firstname+lastname@example.com',
				'email@123.123.123.123',
				'1234567890@example.com',
				'email@example-one.com',
				'_______@example.com',
				'email@example.name',
				'email@example.museum',
				'email@example.co.jp',
				'firstname-lastname@example.com',
				'Abc..123@example.com',
				'email@111.222.333.44444',
				'email@example.web',
				'email@example',
				'email..email@example.com',
				'email.@example.com',
				'.email@example.com'
			];

			for (let i = 0; i < validEmails.length; i++) {
				const data = {
					...validCredentials,
					...registrationInfo,
					email: validEmails[i]
				};
				expect(await Firewall.validate(Services.AUTH, AuthServiceMethods.REGISTER, data)).to.be.deep.eq(data);
			}
		});
	});

	describe('telephone spec', () => {
		it('is required', async () => {
			const data = {
				...validCredentials,
				...registrationInfo
			};
			delete data.telephone;
			await testRequired(Services.AUTH, AuthServiceMethods.REGISTER, data, '', 'telephone');
		});

		it('has min length of 3 chars', async () => {
			const data = {
				...validCredentials,
				...registrationInfo,
				telephone: '+4'
			};
			await testPattern(Services.AUTH, AuthServiceMethods.REGISTER, data, '.telephone', '^\\+[1-9]\\d{1,14}$');
		});

		it('has max of 15 chars', async () => {
			const data = {
				...validCredentials,
				...registrationInfo,
				telephone: `+${generateString(16, /^[1-9]$/)}`
			};
			await testPattern(Services.AUTH, AuthServiceMethods.REGISTER, data, '.telephone', '^\\+[1-9]\\d{1,14}$');
		});

		it('needs to start with country code', async () => {
			const data = {
				...validCredentials,
				...registrationInfo,
				telephone: '07756'
			};
			await testPattern(Services.AUTH, AuthServiceMethods.REGISTER, data, '.telephone', '^\\+[1-9]\\d{1,14}$');
		});

		it("can't contain letters", async () => {
			const data = {
				...validCredentials,
				...registrationInfo,
				telephone: `+${generateString(16, /^[a-zA-Z]$/)}`
			};
			await testPattern(Services.AUTH, AuthServiceMethods.REGISTER, data, '.telephone', '^\\+[1-9]\\d{1,14}$');
		});
	});

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

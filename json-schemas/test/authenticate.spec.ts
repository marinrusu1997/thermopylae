import { describe, it } from 'mocha';
import { Services, AuthServiceMethods } from '@marin/declarations/lib/services';
import { expect } from 'chai';
import { Firewall } from '@marin/lib.firewall';
import { passwordTestsSuite, usernameTestsSuite } from './test-cases/credentials-test-cases';
import { generateString, testAdditionalProperties, testPattern, testMaxLength, testMinLength, testRequired, testType } from './utils';

describe(`${Services.AUTH}-${AuthServiceMethods.AUTHENTICATE} spec`, () => {
	const validCredentials = {
		username: 'validpassword',
		password: '!@45Masdasdidgh'
	};

	const authenticationInfo = {
		ip: '127.0.0.1',
		device: 'device'
	};

	describe('credentials spec', () => {
		usernameTestsSuite(Services.AUTH, AuthServiceMethods.AUTHENTICATE, authenticationInfo);
		passwordTestsSuite(Services.AUTH, AuthServiceMethods.AUTHENTICATE, { ...authenticationInfo, username: 'validusername' });

		it('password not required when totp is present', async () => {
			const data = {
				username: 'username',
				...authenticationInfo,
				totp: '123456'
			};
			expect(await Firewall.validate(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data)).to.be.eq(data);
		});

		it('password not required when generateChallenge is present', async () => {
			const data = {
				username: 'username',
				...authenticationInfo,
				generateChallenge: true
			};
			expect(await Firewall.validate(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data)).to.be.eq(data);
		});

		it('password not required when responseForChallenge is present', async () => {
			const data = {
				username: 'username',
				...authenticationInfo,
				responseForChallenge: {
					signature: generateString(10),
					signAlgorithm: 'rsa',
					signEncoding: 'utf8'
				}
			};
			expect(await Firewall.validate(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data)).to.be.eq(data);
		});
	});

	describe('ip spec', () => {
		it('is required', async () => {
			const data = {
				...validCredentials,
				device: 'device'
			};
			await testRequired(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data, '', 'ip');
		});

		it('is string', async () => {
			const data = {
				...validCredentials,
				device: 'device',
				ip: []
			};
			await testType(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data, '.ip', 'string');
		});

		it('rejects invalid ipv4 address', async () => {
			const data = {
				...validCredentials,
				...authenticationInfo,
				ip: '1455.12.12.12'
			};
			await testPattern(
				Services.AUTH,
				AuthServiceMethods.AUTHENTICATE,
				data,
				'.ip',
				'((^\\s*((([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]))\\s*$)|(^\\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:)))(%.+)?\\s*$))'
			);
		});

		it('validates ipv4 address', async () => {
			const data = {
				...validCredentials,
				...authenticationInfo,
				ip: '10.189.65.36'
			};
			expect(await Firewall.validate(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data)).to.be.eq(data);
		});

		it('rejects invalid ipv6 address', async () => {
			const data = {
				...validCredentials,
				...authenticationInfo,
				ip: '1200:0000:AB00:1234:O000:2552:7777:1313'
			};
			await testPattern(
				Services.AUTH,
				AuthServiceMethods.AUTHENTICATE,
				data,
				'.ip',
				'((^\\s*((([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]))\\s*$)|(^\\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:)))(%.+)?\\s*$))'
			);
		});

		it('validates ipv6 address', async () => {
			const data = {
				...validCredentials,
				...authenticationInfo,
				ip: '1200:0000:AB00:1234:0000:2552:7777:1313'
			};
			expect(await Firewall.validate(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data)).to.be.eq(data);
		});
	});

	describe('device spec', () => {
		it('is required', async () => {
			const data = {
				...validCredentials,
				ip: '127.0.0.1'
			};
			await testRequired(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data, '', 'device');
		});

		it('is string', async () => {
			const data = {
				...validCredentials,
				ip: '127.0.0.1',
				device: 146565626
			};
			await testType(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data, '.device', 'string');
		});

		it('has min length of 5 characters', async () => {
			const data = {
				...validCredentials,
				...authenticationInfo,
				device: generateString(4)
			};
			await testMinLength(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data, '.device', 5);
		});

		it('has max length of 300 characters', async () => {
			const data = {
				...validCredentials,
				...authenticationInfo,
				device: generateString(301)
			};
			await testMaxLength(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data, '.device', 300);
		});
	});

	describe('totp spec', () => {
		it('contains exactly 6 digits', async () => {
			const data = {
				...validCredentials,
				...authenticationInfo,
				totp: '123456'
			};
			expect(await Firewall.validate(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data)).to.be.eq(data);
		});

		it('is string', async () => {
			const data = {
				...validCredentials,
				...authenticationInfo,
				totp: 123456
			};
			await testType(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data, '.totp', 'string');
		});

		it("can't contain less than 6 digits", async () => {
			const data = {
				...validCredentials,
				...authenticationInfo,
				totp: '12345'
			};
			await testPattern(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data, '.totp', '^[0-9]{6}$');
		});

		it("can't contain more than 6 digits", async () => {
			const data = {
				...validCredentials,
				...authenticationInfo,
				totp: '1234567'
			};
			await testPattern(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data, '.totp', '^[0-9]{6}$');
		});
	});

	describe('recaptcha spec', () => {
		it('is string', async () => {
			const data = {
				...validCredentials,
				...authenticationInfo,
				recaptcha: 12345
			};
			await testType(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data, '.recaptcha', 'string');
		});

		it('has max length of 50 chars', async () => {
			const data = {
				...validCredentials,
				...authenticationInfo,
				recaptcha: generateString(51)
			};
			await testMaxLength(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data, '.recaptcha', 50);
		});
	});

	describe('generateChallenge spec', () => {
		it('is boolean', async () => {
			const data = {
				...validCredentials,
				...authenticationInfo,
				generateChallenge: 12345
			};
			await testType(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data, '.generateChallenge', 'boolean');
		});
	});

	describe('responseForChallenge', () => {
		describe('signature spec', () => {
			it('is required', async () => {
				const data = {
					...validCredentials,
					...authenticationInfo,
					responseForChallenge: {
						signAlgorithm: 'rsa',
						signEncoding: 'utf8'
					}
				};
				await testRequired(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data, '.responseForChallenge', 'signature');
			});

			it('has min length of 10 chars', async () => {
				const data = {
					...validCredentials,
					...authenticationInfo,
					responseForChallenge: {
						signature: generateString(9),
						signAlgorithm: 'rsa',
						signEncoding: 'utf8'
					}
				};
				await testMinLength(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data, '.responseForChallenge.signature', 10);
			});

			it('has max length of 256 characters', async () => {
				const data = {
					...validCredentials,
					...authenticationInfo,
					responseForChallenge: {
						signature: generateString(257),
						signAlgorithm: 'rsa',
						signEncoding: 'utf8'
					}
				};
				await testMaxLength(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data, '.responseForChallenge.signature', 256);
			});
		});

		describe('signAlgorithm spec', () => {
			it('is required', async () => {
				const data = {
					...validCredentials,
					...authenticationInfo,
					responseForChallenge: {
						signature: generateString(10),
						signEncoding: 'utf8'
					}
				};
				await testRequired(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data, '.responseForChallenge', 'signAlgorithm');
			});

			it('has max length of 50 characters', async () => {
				const data = {
					...validCredentials,
					...authenticationInfo,
					responseForChallenge: {
						signature: generateString(10),
						signAlgorithm: generateString(51),
						signEncoding: 'utf8'
					}
				};
				await testMaxLength(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data, '.responseForChallenge.signAlgorithm', 50);
			});
		});

		describe('signEncoding spec', () => {
			it('is required', async () => {
				const data = {
					...validCredentials,
					...authenticationInfo,
					responseForChallenge: {
						signature: generateString(10),
						signAlgorithm: 'rsa'
					}
				};
				await testRequired(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data, '.responseForChallenge', 'signEncoding');
			});

			it('has max length of 50 characters', async () => {
				const data = {
					...validCredentials,
					...authenticationInfo,
					responseForChallenge: {
						signature: generateString(10),
						signAlgorithm: generateString(10),
						signEncoding: generateString(51)
					}
				};
				await testMaxLength(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data, '.responseForChallenge.signEncoding', 50);
			});
		});
	});

	it('should not contain additional properties', async () => {
		const data = {
			...validCredentials,
			...authenticationInfo,
			'@additionalProperty@': []
		};
		await testAdditionalProperties(Services.AUTH, AuthServiceMethods.AUTHENTICATE, data);
	});
});
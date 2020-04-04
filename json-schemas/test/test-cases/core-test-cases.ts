import { describe, it } from 'mocha';
import { expect } from 'chai';
import { Firewall } from '@marin/lib.firewall';
import { Services } from '@marin/declarations/lib/services';
import { generateString, testFormat, testMaxLength, testMinLength, testPattern, testRequired, testType } from '../utils';

function idTestSuite(service: Services, method: string, serviceSpecificData: object, idPropertyName: string): void {
	describe(`${idPropertyName} spec`, () => {
		it('is required', async () => {
			await testRequired(service, method, serviceSpecificData, '', idPropertyName);
		});

		it('is string', async () => {
			const data = {
				...serviceSpecificData,
				[idPropertyName]: 1
			};
			await testType(service, method, data, `.${idPropertyName}`, 'string');
		});

		it('has min length of 5 chars', async () => {
			const data = {
				...serviceSpecificData,
				[idPropertyName]: generateString(4)
			};
			await testMinLength(service, method, data, `.${idPropertyName}`, 5);
		});

		it('has max length of 50 chars', async () => {
			const data = {
				...serviceSpecificData,
				[idPropertyName]: generateString(51)
			};
			await testMaxLength(service, method, data, `.${idPropertyName}`, 50);
		});
	});
}

function tokenTestSuite(service: Services, method: string, serviceSpecificData: object, tokenPropertyName: string): void {
	describe(`${tokenPropertyName} spec`, () => {
		it('is required', async () => {
			await testRequired(service, method, serviceSpecificData, '', tokenPropertyName);
		});

		it('is string', async () => {
			const data = {
				...serviceSpecificData,
				[tokenPropertyName]: 1
			};
			await testType(service, method, data, `.${tokenPropertyName}`, 'string');
		});

		it('has min length of 5 chars', async () => {
			const data = {
				...serviceSpecificData,
				[tokenPropertyName]: generateString(4)
			};
			await testMinLength(service, method, data, `.${tokenPropertyName}`, 5);
		});

		it('has max length of 20 chars', async () => {
			const data = {
				...serviceSpecificData,
				[tokenPropertyName]: generateString(51)
			};
			await testMaxLength(service, method, data, `.${tokenPropertyName}`, 20);
		});

		it("can't contain special symbols", async () => {
			const data = {
				...serviceSpecificData,
				[tokenPropertyName]: generateString(5, /[$%^]/)
			};
			await testPattern(service, method, data, `.${tokenPropertyName}`, '^[a-f0-9]+$');
		});

		it('can contain only hex chars', async () => {
			const data = {
				...serviceSpecificData,
				[tokenPropertyName]: generateString(20, /^[a-f0-9]$/)
			};
			expect(await Firewall.validate(service, method, data)).to.be.deep.eq(data);
		});
	});
}

function emailTestSuite(service: Services, method: string, serviceSpecificData: object, emailPropertyName: string): void {
	describe(`${emailPropertyName} spec`, () => {
		it('is required', async () => {
			const data = { ...serviceSpecificData };
			// @ts-ignore
			delete data[emailPropertyName]; // just to make sure it is not here
			await testRequired(service, method, data, '', emailPropertyName);
		});

		it("can't exceed max length of 254", async () => {
			const data = {
				...serviceSpecificData,
				email: generateString(255)
			};
			await testMaxLength(service, method, data, `.${emailPropertyName}`, 254);
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
					...serviceSpecificData,
					email: invalidEmails[i]
				};
				await testFormat(service, method, data, `.${emailPropertyName}`, 'email');
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
					...serviceSpecificData,
					email: validEmails[i]
				};
				expect(await Firewall.validate(service, method, data)).to.be.deep.eq(data);
			}
		});
	});
}

function telephoneTestSuite(service: Services, method: string, serviceSpecificData: object, telephonePropertyName: string): void {
	describe(`${telephonePropertyName} spec`, () => {
		it('is required', async () => {
			const data = { ...serviceSpecificData };
			// @ts-ignore
			delete data[telephonePropertyName]; // just to make sure
			await testRequired(service, method, data, '', telephonePropertyName);
		});

		it('has min length of 3 chars', async () => {
			const data = {
				...serviceSpecificData,
				telephone: '+4'
			};
			await testPattern(service, method, data, `.${telephonePropertyName}`, '^\\+[1-9]\\d{1,14}$');
		});

		it('has max of 15 chars', async () => {
			const data = {
				...serviceSpecificData,
				telephone: `+${generateString(16, /^[1-9]$/)}`
			};
			await testPattern(service, method, data, `.${telephonePropertyName}`, '^\\+[1-9]\\d{1,14}$');
		});

		it('needs to start with country code', async () => {
			const data = {
				...serviceSpecificData,
				telephone: '07756'
			};
			await testPattern(service, method, data, `.${telephonePropertyName}`, '^\\+[1-9]\\d{1,14}$');
		});

		it("can't contain letters", async () => {
			const data = {
				...serviceSpecificData,
				telephone: `+${generateString(16, /^[a-zA-Z]$/)}`
			};
			await testPattern(service, method, data, `.${telephonePropertyName}`, '^\\+[1-9]\\d{1,14}$');
		});
	});
}

function ipTestSuite(service: Services, method: string, serviceSpecificData: object, ipPropertyName: string): void {
	describe(`${ipPropertyName} spec`, () => {
		it('is required', async () => {
			const data = {
				...serviceSpecificData,
				device: 'device'
			};
			// @ts-ignore
			delete data[ipPropertyName]; // just to make sure is not here
			await testRequired(service, method, data, '', ipPropertyName);
		});

		it('is string', async () => {
			const data = {
				...serviceSpecificData,
				device: 'device',
				ip: []
			};
			await testType(service, method, data, `.${ipPropertyName}`, 'string');
		});

		it('rejects invalid ipv4 address', async () => {
			const data = {
				...serviceSpecificData,
				ip: '1455.12.12.12'
			};
			await testPattern(
				service,
				method,
				data,
				`.${ipPropertyName}`,
				'((^\\s*((([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]))\\s*$)|(^\\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:)))(%.+)?\\s*$))'
			);
		});

		it('validates ipv4 address', async () => {
			const data = {
				...serviceSpecificData,
				ip: '10.189.65.36'
			};
			expect(await Firewall.validate(service, method, data)).to.be.eq(data);
		});

		it('rejects invalid ipv6 address', async () => {
			const data = {
				...serviceSpecificData,
				ip: '1200:0000:AB00:1234:O000:2552:7777:1313'
			};
			await testPattern(
				service,
				method,
				data,
				`.${ipPropertyName}`,
				'((^\\s*((([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]))\\s*$)|(^\\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:)))(%.+)?\\s*$))'
			);
		});

		it('validates ipv6 address', async () => {
			const data = {
				...serviceSpecificData,
				ip: '1200:0000:AB00:1234:0000:2552:7777:1313'
			};
			expect(await Firewall.validate(service, method, data)).to.be.eq(data);
		});
	});
}

function deviceTestSuite(service: Services, method: string, serviceSpecificData: object, devicePropertyName: string): void {
	describe(`${devicePropertyName} spec`, () => {
		it('is required', async () => {
			const data = {
				...serviceSpecificData,
				ip: '127.0.0.1'
			};
			// @ts-ignore
			delete data[devicePropertyName]; // just to make sure
			await testRequired(service, method, data, '', devicePropertyName);
		});

		it('is string', async () => {
			const data = {
				...serviceSpecificData,
				ip: '127.0.0.1',
				device: 146565626
			};
			await testType(service, method, data, `.${devicePropertyName}`, 'string');
		});

		it('has min length of 5 characters', async () => {
			const data = {
				...serviceSpecificData,
				device: generateString(4)
			};
			await testMinLength(service, method, data, `.${devicePropertyName}`, 5);
		});

		it('has max length of 300 characters', async () => {
			const data = {
				...serviceSpecificData,
				device: generateString(301)
			};
			await testMaxLength(service, method, data, `.${devicePropertyName}`, 300);
		});
	});
}

export { idTestSuite, tokenTestSuite, emailTestSuite, telephoneTestSuite, ipTestSuite, deviceTestSuite };

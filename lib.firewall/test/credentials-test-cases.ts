import { describe, it } from 'mocha';
import { expect } from 'chai';
import { string } from '@marin/lib.utils';
// eslint-disable-next-line import/no-unresolved
import { Services } from '@marin/lib.utils/dist/enums';
import { Firewall } from '../lib';
import { generateString, testMaxLength, testMinLength, testPattern, testRequired, testType } from './utils';

function usernameTestsSuite(service: Services, method: string, serviceSpecificData: object): void {
	describe('username spec', () => {
		it('is required', async () => {
			const data = { ...serviceSpecificData };
			await testRequired(service, method, data, '', 'username');
		});

		it('is string', async () => {
			const data = {
				username: 1,
				password: '!@45Masdasdidgh',
				...serviceSpecificData
			};
			await testType(service, method, data, '.username', 'string');
		});

		it('has min 6 chars', async () => {
			const data = {
				username: 'short',
				password: '!@45Masdasdidgh',
				...serviceSpecificData
			};
			await testPattern(service, method, data, '.username', '^(?=.{6,50}$)(?![_.])(?!.*[_.]{2})[a-zA-Z0-9._]+(?<![_.])$');
		});

		it('has max 50 chars', async () => {
			const data = {
				username: 'm5UXJPDZTOqFmnTlAkNQBeCTzEApzAus40xC8QfJaR9KsZlUo61',
				password: '!@45Masdasdidgh',
				...serviceSpecificData
			};
			await testPattern(service, method, data, '.username', '^(?=.{6,50}$)(?![_.])(?!.*[_.]{2})[a-zA-Z0-9._]+(?<![_.])$');
		});

		it('only contains alphanumeric characters, underscore and dot', async () => {
			for (let i = 0; i < 10; i++) {
				const data = {
					username: generateString(6, /^[^a-zA-Z0-9._]$/),
					password: '!@45Masdasdidgh',
					...serviceSpecificData
				};
				await testPattern(service, method, data, '.username', '^(?=.{6,50}$)(?![_.])(?!.*[_.]{2})[a-zA-Z0-9._]+(?<![_.])$');
			}
		});

		it("underscore and dot can't be at the end or start of a username", async () => {
			for (let i = 0; i < 10; i++) {
				const data = {
					username: `${generateString(1, /^[._]$/)}${generateString(5, /^[a-zA-Z0-9._]$/)}${generateString(1, /^[._]$/)}`,
					password: '!@45Masdasdidgh',
					...serviceSpecificData
				};
				data.username = string.replaceAt('a', Math.random() > 0.5 ? 0 : data.username.length, data.username);
				await testPattern(service, method, data, '.username', '^(?=.{6,50}$)(?![_.])(?!.*[_.]{2})[a-zA-Z0-9._]+(?<![_.])$');
			}
		});

		it("underscore and dot can't be next to each other", async () => {
			const data = {
				username: 'user_.name',
				password: '!@45Masdasdidgh',
				...serviceSpecificData
			};
			await testPattern(service, method, data, '.username', '^(?=.{6,50}$)(?![_.])(?!.*[_.]{2})[a-zA-Z0-9._]+(?<![_.])$');
		});

		it("underscore can't be used multiple times in a row", async () => {
			const data = {
				username: 'user__name',
				password: '!@45Masdasdidgh',
				...serviceSpecificData
			};
			await testPattern(service, method, data, '.username', '^(?=.{6,50}$)(?![_.])(?!.*[_.]{2})[a-zA-Z0-9._]+(?<![_.])$');
		});

		it("dot can't be used multiple times in a row", async () => {
			const data = {
				username: 'user..name',
				password: '!@45Masdasdidgh',
				...serviceSpecificData
			};
			await testPattern(service, method, data, '.username', '^(?=.{6,50}$)(?![_.])(?!.*[_.]{2})[a-zA-Z0-9._]+(?<![_.])$');
		});
	});
}

function passwordTestsSuite(service: Services, method: string, serviceSpecificData: object, passwordPropertyName = 'password'): void {
	describe('password spec', () => {
		it('is required', async () => {
			const data = {
				username: 'validusername',
				...serviceSpecificData
			};
			await testRequired(service, method, data, '', [passwordPropertyName, `.${passwordPropertyName}`]);
		});

		it('is string', async () => {
			const data = {
				username: 'validusername',
				[passwordPropertyName]: 1,
				...serviceSpecificData
			};
			await testType(service, method, data, `.${passwordPropertyName}`, 'string');
		});

		it('has min length of 10 chars', async () => {
			const data = {
				username: 'validusername',
				[passwordPropertyName]: 'short',
				...serviceSpecificData
			};
			await testMinLength(service, method, data, `.${passwordPropertyName}`, 10);
		});

		it('has max length of 256 chars', async () => {
			const data = {
				username: 'validusername',
				[passwordPropertyName]: generateString(257),
				...serviceSpecificData
			};
			await testMaxLength(service, method, data, `.${passwordPropertyName}`, 256);
		});

		it('passes for valid password', async () => {
			const data = {
				username: 'validusername',
				[passwordPropertyName]: 'r4!Ma4d5g5gdr8',
				...serviceSpecificData
			};
			expect(await Firewall.validate(service, method, data)).to.be.deep.eq(data);
		});
	});
}

export { usernameTestsSuite, passwordTestsSuite };

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { services, string } from '@marin/lib.utils';
import { Firewall } from '../lib';
import { generateString, testPattern, testRequired } from './utils';

function usernameTestsSuite(service: services.SERVICES.AUTH, method: string, serviceSpecificData: object): void {
	describe('username spec', () => {
		it('is required', async () => {
			const data = { ...serviceSpecificData };
			await testRequired(service, method, data, '', 'username');
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
					username: generateString(7, /^[a-zA-Z0-9._]$/, /^[._]$/),
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

function passwordTestsSuite(service: services.SERVICES.AUTH, method: string, serviceSpecificData: object): void {
	describe('password spec', () => {
		it('is required', async () => {
			const data = {
				username: 'validusername',
				...serviceSpecificData
			};
			await testRequired(service, method, data, '', ['password', '.password']);
		});

		it('has min length of 10 chars', async () => {
			const data = {
				username: 'validusername',
				password: 'short',
				...serviceSpecificData
			};
			await testPattern(service, method, data, '.password', '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{10,256}$');
		});

		it('has max length of 256 chars', async () => {
			const data = {
				username: 'validusername',
				password: generateString(257),
				...serviceSpecificData
			};
			await testPattern(service, method, data, '.password', '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{10,256}$');
		});

		it('passes for valid password', async () => {
			const data = {
				username: 'validusername',
				password: 'r4!Ma4d5g5gdr8',
				...serviceSpecificData
			};
			expect(await Firewall.validate(service, method, data)).to.be.deep.eq(data);
		});
	});
}

export { usernameTestsSuite, passwordTestsSuite };

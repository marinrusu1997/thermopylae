import { describe, it } from 'mocha';
import { expect } from 'chai';
import { Services } from '@marin/lib.utils/dist/enums';
import { Firewall } from '../../lib';
import { generateString, testMaxLength, testMinLength, testPattern, testRequired, testType } from '../utils';

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

export { idTestSuite, tokenTestSuite };

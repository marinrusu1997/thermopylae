// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it } from 'mocha';
import { expect } from '@thermopylae/dev.unit-test';
import { ErrorObject } from 'ajv';
import { ApiValidator } from '../lib';
import { apiValidator } from './bootstrap';

describe(`${ApiValidator.prototype.joinErrors.name} spec`, () => {
	it('joins errors into string', () => {
		const errors: ErrorObject[] = [
			{
				keyword: 'minLength',
				instancePath: '.password',
				schemaPath: '../core/credentials.json/properties/password/minLength',
				params: { limit: 10 },
				message: 'should NOT be shorter than 10 characters'
			}
		];
		const joinedErrors = apiValidator.joinErrors(errors, 'text');
		expect(joinedErrors).to.be.eq('data.password must NOT be shorter than 10 characters');
	});

	it('joins errors into object', () => {
		const errors: ErrorObject[] = [
			{
				keyword: 'maxLength',
				instancePath: '.password',
				schemaPath: '../core/credentials.json/properties/password/maxLength',
				params: { limit: 256 },
				message: 'should NOT be longer than 256 characters'
			}
		];
		const joinedErrors = apiValidator.joinErrors(errors, 'object');
		const expectedErrorObject = {
			'.password': 'should NOT be longer than 256 characters'
		};
		expect(joinedErrors).to.be.deep.eq(expectedErrorObject);
	});

	it("skips errors which's keywords values are in the skip list", () => {
		const errors: ErrorObject[] = [
			{
				keyword: 'maxLength',
				instancePath: '.password',
				schemaPath: '../core/credentials.json/properties/password/maxLength',
				params: { limit: 256 },
				message: 'should NOT be longer than 256 characters'
			},
			{
				keyword: 'pattern',
				instancePath: '.username',
				schemaPath: '../core/credentials.json/properties/username/pattern',
				params: {
					pattern: '^(?=.{6,50}$)(?![_.])(?!.*[_.]{2})[a-zA-Z0-9._]+(?<![_.])$'
				},
				message: 'should match pattern "^(?=.{6,50}$)(?![_.])(?!.*[_.]{2})[a-zA-Z0-9._]+(?<![_.])$"'
			}
		];
		const joinedErrors = apiValidator.joinErrors(errors, 'object');
		const expectedErrorObject = {
			'.password': 'should NOT be longer than 256 characters'
		};
		expect(joinedErrors).to.be.deep.eq(expectedErrorObject);
	});
});

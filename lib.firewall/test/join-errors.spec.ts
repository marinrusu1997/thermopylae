import { describe, it } from 'mocha';
import { expect } from 'chai';
import { Firewall } from '../lib';

describe('join errors spec', () => {
	it('joins errors into string', () => {
		const errors = [
			{
				keyword: 'minLength',
				dataPath: '.password',
				schemaPath: '../core/credentials.json/properties/password/minLength',
				params: { limit: 10 },
				message: 'should NOT be shorter than 10 characters'
			}
		];
		const joinedErrors = Firewall.joinErrors(errors, 'text');
		expect(joinedErrors).to.be.eq('data.password should not be shorter than 10 characters');
	});

	it('joins errors into object', () => {
		const errors = [
			{
				keyword: 'maxLength',
				dataPath: '.password',
				schemaPath: '../core/credentials.json/properties/password/maxLength',
				params: { limit: 256 },
				message: 'should NOT be longer than 256 characters'
			}
		];
		const joinedErrors = Firewall.joinErrors(errors, 'object');
		const expectedErrorObject = {
			'.password': 'should NOT be longer than 256 characters'
		};
		expect(joinedErrors).to.be.deep.eq(expectedErrorObject);
	});

	it("skips errors which's keywords values are in the skip list", () => {
		const errors = [
			{
				keyword: 'maxLength',
				dataPath: '.password',
				schemaPath: '../core/credentials.json/properties/password/maxLength',
				params: { limit: 256 },
				message: 'should NOT be longer than 256 characters'
			},
			{
				keyword: 'pattern',
				dataPath: '.username',
				schemaPath: '../core/credentials.json/properties/username/pattern',
				params: {
					pattern: '^(?=.{6,50}$)(?![_.])(?!.*[_.]{2})[a-zA-Z0-9._]+(?<![_.])$'
				},
				message: 'should match pattern "^(?=.{6,50}$)(?![_.])(?!.*[_.]{2})[a-zA-Z0-9._]+(?<![_.])$"'
			}
		];
		const joinedErrors = Firewall.joinErrors(errors, 'object');
		const expectedErrorObject = {
			'.password': 'should NOT be longer than 256 characters'
		};
		expect(joinedErrors).to.be.deep.eq(expectedErrorObject);
	});
});

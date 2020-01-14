import { assert, AssertionError, expect } from 'chai';
import { Jwt } from '@marin/lib.jwt';

/**
 * Checks if provided jwt was invalidated, i.e. blacklisted
 * Intended for usage by test cases.
 *
 * @param token
 * @param jwt
 */
async function checkIfJWTWasInvalidated(token: string, jwt: Jwt): Promise<void> {
	let jwtValidateError;
	try {
		await jwt.validate(token);
		assert(false, `Authorization was made, even if token ${token} needed to be invalidated!`);
	} catch (e) {
		if (e instanceof AssertionError) {
			throw e;
		}
		jwtValidateError = e;
	}
	expect(jwtValidateError)
		.to.be.instanceOf(Error)
		.and.to.haveOwnProperty('name', 'JsonWebTokenError');
	expect(jwtValidateError.message.substr(jwtValidateError.message.length - 11)).to.be.eq('blacklisted');
}

export { checkIfJWTWasInvalidated };

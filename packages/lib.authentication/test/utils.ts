import { assert, AssertionError, expect } from 'chai';
import { Jwt } from '@marin/lib.jwt';
import { AuthEngineOptions, AuthenticationEngine } from '../lib';
import { AuthenticationContext } from '../lib/types/requests';
import { AuthStatus } from '../lib/authentication/auth-step';
import { HashingAlgorithms, PasswordHasher } from './fixtures/password-hasher';

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
	expect(jwtValidateError).to.be.instanceOf(Error).and.to.haveOwnProperty('name', 'JsonWebTokenError');
	expect(jwtValidateError.message.substr(jwtValidateError.message.length - 11)).to.be.eq('blacklisted');
}

/**
 * Checks that authentication was successful and returns authentication status in case of success,
 * having the authentication JsonWebToken
 *
 * @param authEngine
 * @param authRequest
 */
async function validateSuccessfulLogin(authEngine: AuthenticationEngine, authRequest: AuthenticationContext): Promise<AuthStatus> {
	const authStatus = await authEngine.authenticate(authRequest);

	expect(authStatus.token).to.not.be.eq(undefined);
	expect(authStatus.token).to.be.an('string');
	expect(authStatus.error).to.be.eq(undefined);
	expect(authStatus.nextStep).to.be.eq(undefined);

	return authStatus;
}

function createAuthEnginesWithDifferentPasswordHashingAlg(baseConfig: AuthEngineOptions): Array<AuthenticationEngine> {
	return [
		new AuthenticationEngine({ ...baseConfig, passwordHasher: new PasswordHasher(HashingAlgorithms.BCRYPT) }),
		new AuthenticationEngine({ ...baseConfig, passwordHasher: new PasswordHasher(HashingAlgorithms.ARGON2) })
	];
}

export { checkIfJWTWasInvalidated, validateSuccessfulLogin, createAuthEnginesWithDifferentPasswordHashingAlg };

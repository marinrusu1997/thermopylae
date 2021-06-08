import { expect } from '@thermopylae/lib.unit-test';
import { AuthenticationStatus } from '../lib';

function validateSuccessfulLogin(authStatus: AuthenticationStatus): void | never {
	expect(authStatus.token).to.be.eq(undefined);
	expect(authStatus.nextStep).to.be.eq(undefined);
	expect(authStatus.error).to.be.eq(undefined);
	expect(authStatus.authenticated).to.be.eq(true);
}

/* function createAuthEnginesWithDifferentPasswordHashingAlg(baseConfig: AuthenticationEngineOptions): Array<AuthenticationEngine> {
	return [
		new AuthenticationEngine({ ...baseConfig, passwordHasher: new PasswordHasher(HashingAlgorithms.BCRYPT) }),
		new AuthenticationEngine({ ...baseConfig, passwordHasher: new PasswordHasher(HashingAlgorithms.ARGON2) })
	];
} */

export { validateSuccessfulLogin };

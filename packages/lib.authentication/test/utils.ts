import { expect } from '@thermopylae/lib.unit-test';
import { Authenticator } from '@otplib/core';
import { createDigest, createRandomBytes } from '@otplib/plugin-crypto';
import { keyDecoder, keyEncoder } from '@otplib/plugin-thirty-two';
import { TotpDefaultOptions } from './fixtures';
import { AuthenticationStatus } from '../lib';
import { SecretEncryptor } from '../lib/helpers/secret-encryptor';

function validateSuccessfulLogin(authStatus: AuthenticationStatus): void | never {
	expect(authStatus.token).to.be.eq(undefined);
	expect(authStatus.nextStep).to.be.eq(undefined);
	expect(authStatus.error).to.be.eq(undefined);
	expect(authStatus.authenticated).to.be.eq(true);
}

const TotpAuthenticator = new Authenticator({
	...TotpDefaultOptions.totp.authenticator,
	createDigest,
	createRandomBytes,
	keyDecoder,
	keyEncoder
});

const TotpSecretEncryptor = new SecretEncryptor(TotpDefaultOptions.totp.encryption);

function generateTotp(secret: string): string {
	return TotpAuthenticator.generate(TotpSecretEncryptor.decrypt(secret));
}

/* function createAuthEnginesWithDifferentPasswordHashingAlg(baseConfig: AuthenticationEngineOptions): Array<AuthenticationEngine> {
	return [
		new AuthenticationEngine({ ...baseConfig, passwordHasher: new PasswordHasher(HashingAlgorithms.BCRYPT) }),
		new AuthenticationEngine({ ...baseConfig, passwordHasher: new PasswordHasher(HashingAlgorithms.ARGON2) })
	];
} */

export { validateSuccessfulLogin, generateTotp };

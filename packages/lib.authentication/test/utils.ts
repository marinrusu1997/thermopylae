import { Authenticator } from '@otplib/core';
import { createDigest, createRandomBytes } from '@otplib/plugin-crypto';
import { keyDecoder, keyEncoder } from '@otplib/plugin-thirty-two';
import { createSign } from 'crypto';
import keypair from 'keypair';
import { expect } from 'vitest';
import { SecretEncryptor } from '../lib/helpers/secret-encryptor.js';
import { AccountStatus } from '../lib/index.js';
import type { AccountToBeRegistered, AccountWithTotpSecret, AuthenticationContext, AuthenticationStatus } from '../lib/index.js';
import { TotpDefaultOptions } from './fixtures/index.js';

/* TOTP */
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

/* ACCOUNT REGISTER */
// @ts-ignore
const AccountKeyPair = keypair();
Object.freeze(AccountKeyPair);

function buildAccountToBeRegistered(): AccountToBeRegistered<AccountWithTotpSecret> {
	return {
		username: 'username',
		passwordHash: 'auirg7q85y1298huwityh289',
		email: 'user@product.com',
		telephone: '+568425666',
		disabledUntil: AccountStatus.ENABLED,
		pubKey: AccountKeyPair.public
	};
}

/* ACCOUNT AUTHENTICATE */
function signChallengeNonce(nonce: string, privateKey?: string): string {
	return createSign('RSA-SHA512')
		.update(nonce)
		.sign(privateKey || AccountKeyPair.private, 'base64');
}

const GlobalAuthenticationContext: AuthenticationContext = {
	username: 'username',
	password: 'auirg7q85y1298huwityh289',
	ip: '158.56.89.230',
	deviceId: 'ah93y5928735yyhauihf98par',
	device: {
		device: {
			type: 'smartphone',
			brand: 'Android',
			model: '9'
		},
		os: {
			name: 'Linux',
			version: '20',
			platform: 'ARM'
		},
		client: {
			name: 'Thermopylae',
			type: 'mobile app',
			version: ''
		},
		bot: null
	},
	location: {
		countryCode: 'US',
		regionCode: 'CA',
		city: 'Los Angeles',
		timezone: 'America/Los_Angeles',
		latitude: 34.0577507019043,
		longitude: -118.41380310058594
	}
};
Object.freeze(GlobalAuthenticationContext);

/* ASSERTIONS */
function validateSuccessfulLogin(authStatus: AuthenticationStatus<AccountWithTotpSecret>): void | never {
	expect(authStatus.token).to.be.eq(undefined);
	expect(authStatus.nextStep).to.be.eq(undefined);
	expect(authStatus.error).to.be.eq(undefined);
	expect(authStatus.authenticated).to.not.be.eq(null);
	expect(Array.isArray(authStatus.authenticated)).to.be.eq(false);
	expect(typeof authStatus.authenticated).to.be.eq('object');
}

export { validateSuccessfulLogin, generateTotp, buildAccountToBeRegistered, signChallengeNonce, GlobalAuthenticationContext, AccountKeyPair };

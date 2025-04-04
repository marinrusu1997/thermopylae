import { Authenticator } from '@otplib/core';
import { createDigest, createRandomBytes } from '@otplib/plugin-crypto';
import { keyDecoder, keyEncoder } from '@otplib/plugin-thirty-two';
import { deepFreeze } from '@thermopylae/lib.utils';
import keypair from 'keypair';
import { createSign } from 'node:crypto';
import { expect } from 'vitest';
import { SecretEncryptor } from '../lib/helpers/secret-encryptor.js';
import { AccountStatus, type AccountToBeRegistered, type AccountWithTotpSecret, type AuthenticationContext, type AuthenticationStatus } from '../lib/index.js';
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
// @ts-expect-error-error
const AccountKeyPair = Object.freeze(keypair());

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

const GlobalAuthenticationContext: AuthenticationContext = deepFreeze({
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
		latitude: 34.057_750_701_904_3,
		longitude: -118.413_803_100_585_94
	}
});

/* ASSERTIONS */
function validateSuccessfulLogin(authStatus: AuthenticationStatus<AccountWithTotpSecret>): void | never {
	expect(authStatus.token).toBeUndefined();
	expect(authStatus.nextStep).toBeUndefined();
	expect(authStatus.error).toBeUndefined();
	expect(authStatus.authenticated).to.not.be.eq(null);
	expect(Array.isArray(authStatus.authenticated)).to.be.eq(false);
	expect(typeof authStatus.authenticated).to.be.eq('object');
}

export { validateSuccessfulLogin, generateTotp, buildAccountToBeRegistered, signChallengeNonce, GlobalAuthenticationContext, AccountKeyPair };

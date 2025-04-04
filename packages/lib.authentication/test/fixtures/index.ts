import argon2 from 'argon2';
import { createHash, privateDecrypt, publicEncrypt, randomBytes } from 'crypto';
import { afterAll, afterEach, beforeAll } from 'vitest';
import {
	type AccountWithTotpSecret,
	Argon2PasswordHashingAlgorithm,
	type AuthenticationEngineOptions,
	PasswordLengthValidator,
	PasswordStrengthValidator,
	PwnedPasswordValidator,
	TotpTwoFactorAuthStrategy,
	type TotpTwoFactorAuthStrategyOptions,
	type UserInputsProvider
} from '../../lib/index.js';
import { OnAccountDisabledHookMock, OnAuthFromDifferentContextHookMock, OnForgottenPasswordChangedHookMock, OnPasswordChangedHookMock } from './hooks.js';
import { MemoryCache } from './memory-cache.js';
import { clearMongoDatabase, connectToMongoDatabase, dropMongoDatabase } from './mongodb.js';
import { BcryptPasswordHashingAlgorithm } from './password/bcrypt.js';
import { ActivateAccountSessionMemoryRepository } from './repositories/memory/activate-account-session.js';
import { AuthenticationSessionMemoryRepository } from './repositories/memory/auth-session.js';
import { FailedAuthAttemptSessionMemoryRepository } from './repositories/memory/failed-auth-session.js';
import { ForgotPasswordSessionMemoryRepository } from './repositories/memory/forgot-password-session.js';
import { AccountRepositoryMongo } from './repositories/mongo/account.js';
import { FailedAuthenticationAttemptsRepositoryMongo } from './repositories/mongo/failed-auth.js';
import { SuccessfulAuthenticationsRepositoryMongo } from './repositories/mongo/successful-auth.js';
import { EmailSenderInstance } from './senders/email.js';
import { SmsSenderInstance } from './senders/sms.js';
import { challengeResponseValidator, recaptchaValidator } from './validators.js';

const argon2PasswordHashingAlgorithm = new Argon2PasswordHashingAlgorithm({
	type: argon2.argon2id,
	hashLength: 5,
	memoryCost: 8192,
	parallelism: 4,
	timeCost: 2
});

const TotpDefaultOptions: TotpTwoFactorAuthStrategyOptions = {
	serviceName: 'thermopylae',
	totp: {
		secretLength: 5,
		encryption: {
			algorithm: 'aes-256-ctr',
			secret: createHash('sha256').update('7hiufha809273509ujhifou909i6jg').digest('base64').substr(0, 32),
			iv: randomBytes(16).toString('hex').slice(0, 16)
		},
		authenticator: {
			algorithm: 'sha1',
			encoding: 'base64',
			step: 10,
			window: 1,
			digits: 6
		}
	}
};
Object.freeze(TotpDefaultOptions);

const ThermopylaeUserInputsProvider: UserInputsProvider<AccountWithTotpSecret> = (account) => {
	if (account.telephone == null) {
		return ['thermopylae', account.username, account.email];
	}

	return ['thermopylae', account.username, account.email, account.telephone];
};

const PasswordLengthValidatorOptions = {
	minLength: 4,
	maxLength: 4_096
};
Object.freeze(PasswordLengthValidatorOptions);

const ForgotPasswordTokenEncryption = {
	encrypt: async (pubKey: string, token: string) => {
		return publicEncrypt(pubKey, Buffer.from(token)).toString('base64');
	},
	decrypt: (privateKey: string, token: string) => {
		return privateDecrypt(privateKey, Buffer.from(token, 'base64')).toString('utf8');
	}
};
Object.freeze(ForgotPasswordTokenEncryption);

const AuthenticationEngineDefaultOptions: AuthenticationEngineOptions<AccountWithTotpSecret> = {
	thresholds: {
		maxFailedAuthAttempts: 3,
		failedAuthAttemptsRecaptcha: 2
	},
	ttl: {
		authenticationSession: 2,
		failedAuthAttemptsSession: 5,
		activateAccountSession: 5,
		forgotPasswordSession: 5,
		accountDisableTimeout: 1
	},
	repositories: {
		account: AccountRepositoryMongo,
		successfulAuthentications: SuccessfulAuthenticationsRepositoryMongo,
		failedAuthenticationAttempts: FailedAuthenticationAttemptsRepositoryMongo,
		activateAccountSession: ActivateAccountSessionMemoryRepository,
		authenticationSession: AuthenticationSessionMemoryRepository,
		failedAuthAttemptSession: FailedAuthAttemptSessionMemoryRepository,
		forgotPasswordSession: ForgotPasswordSessionMemoryRepository
	},
	hooks: {
		onAuthenticationFromDifferentContext: OnAuthFromDifferentContextHookMock.hook,
		onAccountDisabled: OnAccountDisabledHookMock.hook,
		onForgottenPasswordChanged: OnForgottenPasswordChangedHookMock.hook,
		onPasswordChanged: OnPasswordChangedHookMock.hook
	},
	validators: {
		recaptcha: recaptchaValidator,
		challengeResponse: challengeResponseValidator
	},
	password: {
		hashing: {
			algorithms: new Map([
				[0, argon2PasswordHashingAlgorithm],
				[1, new BcryptPasswordHashingAlgorithm()]
			]),
			currentAlgorithmId: 0,
			currentAlgorithm: argon2PasswordHashingAlgorithm
		},
		encryption: false,
		strength: [
			new PasswordLengthValidator(PasswordLengthValidatorOptions.minLength, PasswordLengthValidatorOptions.maxLength),
			new PasswordStrengthValidator(ThermopylaeUserInputsProvider),
			new PwnedPasswordValidator(1)
		],
		similarity: 0.8,
		forgotPasswordTokenEncrypt: ForgotPasswordTokenEncryption.encrypt
	},
	email: {
		admin: 'admin@thermopylae.io',
		sender: EmailSenderInstance
	},
	smsSender: SmsSenderInstance,
	twoFactorAuthStrategy: new TotpTwoFactorAuthStrategy<AccountWithTotpSecret>(TotpDefaultOptions),
	tokensLength: 15
};
Object.freeze(AuthenticationEngineDefaultOptions);

// trigger automatic clean up after each test (will be done at the first import)
afterEach(async () => {
	await clearMongoDatabase();
	MemoryCache.clear();
	EmailSenderInstance.client.reset();
	SmsSenderInstance.client.reset();
	OnAuthFromDifferentContextHookMock.calls.length = 0;
	OnAccountDisabledHookMock.calls.length = 0;
	OnForgottenPasswordChangedHookMock.calls.length = 0;
	OnPasswordChangedHookMock.calls.length = 0;
});

// trigger global hooks at the first import in test suite files
beforeAll(connectToMongoDatabase);
afterAll(dropMongoDatabase);

export { AuthenticationEngineDefaultOptions, TotpDefaultOptions, PasswordLengthValidatorOptions, ForgotPasswordTokenEncryption };

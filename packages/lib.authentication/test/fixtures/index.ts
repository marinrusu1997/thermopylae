import { after, afterEach, before } from 'mocha';
import { argon2id } from 'argon2';
import { createHash, privateDecrypt, publicEncrypt, randomBytes } from 'crypto';
import {
	AccountWithTotpSecret,
	Argon2PasswordHashingAlgorithm,
	AuthenticationEngineOptions,
	PasswordLengthValidator,
	PasswordStrengthValidator,
	PwnedPasswordValidator,
	TotpTwoFactorAuthStrategy,
	TotpTwoFactorAuthStrategyOptions,
	UserInputsProvider
} from '../../lib';
import { AccountRepositoryMongo } from './repositories/mongo/account';
import { SuccessfulAuthenticationsRepositoryMongo } from './repositories/mongo/successful-auth';
import { FailedAuthenticationAttemptsRepositoryMongo } from './repositories/mongo/failed-auth';
import { ActivateAccountSessionMemoryRepository } from './repositories/memory/activate-account-session';
import { AuthenticationSessionMemoryRepository } from './repositories/memory/auth-session';
import { FailedAuthAttemptSessionMemoryRepository } from './repositories/memory/failed-auth-session';
import { ForgotPasswordSessionMemoryRepository } from './repositories/memory/forgot-password-session';
import { clearMongoDatabase, connectToMongoDatabase, dropMongoDatabase } from './mongodb';
import { MemoryCache } from './memory-cache';
import { EmailSenderInstance } from './senders/email';
import { SmsSenderInstance } from './senders/sms';
import { OnAccountDisabledHookMock, OnAuthFromDifferentContextHookMock, OnForgottenPasswordChangedHookMock, OnPasswordChangedHookMock } from './hooks';
import { challengeResponseValidator, recaptchaValidator } from './validators';
import { BcryptPasswordHashingAlgorithm } from './password/bcrypt';

const argon2PasswordHashingAlgorithm = new Argon2PasswordHashingAlgorithm({
	type: argon2id,
	hashLength: 5,
	memoryCost: 8192,
	parallelism: 4,
	timeCost: 1,
	saltLength: 8
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
	'2fa-strategy': new TotpTwoFactorAuthStrategy<AccountWithTotpSecret>(TotpDefaultOptions),
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
before(connectToMongoDatabase);
after(dropMongoDatabase);

export { AuthenticationEngineDefaultOptions, TotpDefaultOptions, PasswordLengthValidatorOptions, ForgotPasswordTokenEncryption };

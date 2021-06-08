export type { TwoFactorAuthStrategy } from './authentication/2fa/interface';
export { EmailTwoFactorAuthStrategy, EmailTwoFactorAuthStrategyOptions, SendEmailWithToken } from './authentication/2fa/email';
export { SmsTwoFactorAuthStrategy, SmsTwoFactorAuthStrategyOptions, SendSmsWithToken } from './authentication/2fa/sms';
export { TotpTwoFactorAuthStrategy, TotpTwoFactorAuthStrategyOptions, OnTwoFactorEnabledHookResult, AccountWithTotpSecret } from './authentication/2fa/totp';

export type { AuthenticationStatus } from './authentication/step';

export type { PasswordHash, PasswordHashingAlgorithm } from './managers/password/hash';
export { Argon2PasswordHashingAlgorithm } from './managers/password/hash/argon2';
export type { PasswordStrengthPolicyValidator } from './managers/password/strength/policy';
export { PasswordLengthValidator } from './managers/password/strength/length-policy';
export { PwnedPasswordValidator } from './managers/password/strength/pwned-policy';
export { PasswordStrengthValidator } from './managers/password/strength/strength-policy';
export type { PasswordHashing } from './managers/password/index';

export type { BaseContext, ChangePasswordContext, SetTwoFactorAuthenticationContext, AuthenticationContext } from './types/contexts';
export { AccountStatus } from './types/enums';
export type { OnForgottenPasswordChangedHook, OnPasswordChangedHook, OnAccountDisabledHook } from './types/hooks';
export type { AccountModel, FailedAuthenticationModel, SuccessfulAuthenticationModel, UserCredentials } from './types/models';
export type {
	ForgotPasswordSessionRepository,
	SuccessfulAuthenticationsRepository,
	FailedAuthenticationAttemptsRepository,
	FailedAuthAttemptSessionRepository,
	ActivateAccountSessionRepository,
	AuthenticationSessionRepository,
	AccountRepository
} from './types/repositories';
export type { FailedAuthenticationAttemptSession, AuthenticationSession } from './types/sessions';
export type { SmsSender, EmailSender } from './types/side-channels';

export { AuthenticationEngine } from './engine';
export type { AuthenticationEngineOptions, AccountToBeRegistered } from './engine';

export { ErrorCodes } from './error';

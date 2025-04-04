export type { TwoFactorAuthStrategy } from './authentication/2fa/interface.js';
export { EmailTwoFactorAuthStrategy, type EmailTwoFactorAuthStrategyOptions, type SendEmailWithToken } from './authentication/2fa/email.js';
export { SmsTwoFactorAuthStrategy, type SmsTwoFactorAuthStrategyOptions, type SendSmsWithToken } from './authentication/2fa/sms.js';
export {
	TotpTwoFactorAuthStrategy,
	type TotpTwoFactorAuthStrategyOptions,
	type OnTwoFactorEnabledHookResult,
	type AccountWithTotpSecret
} from './authentication/2fa/totp.js';

export type { AuthenticationStatus, AuthenticationStatusError } from './authentication/step.js';

export type { PasswordHash, PasswordHashingAlgorithm } from './managers/password/hash/types.js';
export { Argon2PasswordHashingAlgorithm, type Argon2PasswordHashingOptions } from './managers/password/hash/argon2.js';
export type { PasswordStrengthPolicyValidator } from './managers/password/strength/policy.js';
export { PasswordLengthValidator } from './managers/password/strength/length-policy.js';
export { PwnedPasswordValidator } from './managers/password/strength/pwned-policy.js';
export { PasswordStrengthValidator, type UserInputsProvider } from './managers/password/strength/strength-policy.js';
export type { PasswordHashingOptions } from './managers/password/index.js';

export type {
	BaseContext,
	ChangePasswordContext,
	SetTwoFactorAuthenticationContext,
	AuthenticationContext,
	AuthenticationContextInterface
} from './types/contexts.js';
export { AccountStatus } from './types/enums.js';
export type { OnForgottenPasswordChangedHook, OnPasswordChangedHook, OnAccountDisabledHook, OnAuthenticationFromDifferentContextHook } from './types/hooks.js';
export type { AccountModel, FailedAuthenticationModel, SuccessfulAuthenticationModel, UserCredentials } from './types/models.js';
export type {
	ForgotPasswordSessionRepository,
	SuccessfulAuthenticationsRepository,
	FailedAuthenticationAttemptsRepository,
	FailedAuthAttemptSessionRepository,
	ActivateAccountSessionRepository,
	AuthenticationSessionRepository,
	AccountRepository
} from './types/repositories.js';
export type { FailedAuthenticationAttemptSession, AuthenticationSession } from './types/sessions.js';
export type { SmsSender, EmailSender } from './types/side-channels.js';

export { AuthenticationEngine } from './engine.js';
export type { AuthenticationEngineOptions, AuthenticationEngineThresholdsOptions, AuthenticationEngineTtlOptions, AccountToBeRegistered } from './engine.js';

export { ErrorCodes } from './error.js';

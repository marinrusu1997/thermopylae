import type { UserCredentials } from './models';
import type { TwoFactorAuthAChannelType } from './enums';
import type { ChangePasswordContext } from './contexts';

interface RegistrationRequestBase extends UserCredentials {
	email: string;
	telephone?: string;
	pubKey?: string | Buffer;
}

interface ChangePasswordRequest extends ChangePasswordContext {
	sessionId: number;
	accountId: string;
	oldPassword: string;
	newPassword: string;
}

interface CreateForgotPasswordSessionRequest {
	username: string;
	'2fa-channel': TwoFactorAuthAChannelType;
}

interface ChangeForgottenPasswordRequest {
	token: string;
	newPassword: string;
}

export type { RegistrationRequestBase, ChangePasswordRequest, CreateForgotPasswordSessionRequest, ChangeForgottenPasswordRequest };

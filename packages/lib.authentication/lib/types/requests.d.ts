import type { Encoding } from 'crypto';
import type { HttpDevice, HTTPRequestLocation } from '@thermopylae/core.declarations';
import type { UserCredentials } from './models';
import type { TwoFactorAuthAChannelType } from './enums';

interface RegistrationRequestBase extends UserCredentials {
	email: string;
	telephone?: string;
	pubKey?: string | Buffer;
}

interface AuthenticationContext {
	username: string;
	password?: string;
	ip: string;
	deviceId: string;
	device?: HttpDevice;
	location?: HTTPRequestLocation;
	'2fa-token'?: string;
	recaptcha?: string;
	generateChallenge?: boolean;
	responseForChallenge?: {
		signature: string | Buffer;
		signAlgorithm: string;
		signEncoding: Encoding;
	};
}

interface ChangePasswordRequest {
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

export type { RegistrationRequestBase, AuthenticationContext, ChangePasswordRequest, CreateForgotPasswordSessionRequest, ChangeForgottenPasswordRequest };

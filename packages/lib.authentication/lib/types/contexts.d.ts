import type { HttpDevice, HTTPRequestLocation } from '@thermopylae/core.declarations';
import type { BinaryToTextEncoding } from 'crypto';

interface BaseContext {
	ip: string;
	device?: HttpDevice;
	location?: HTTPRequestLocation;
}

interface AuthenticationContext extends BaseContext {
	username: string;
	password?: string;
	deviceId: string;
	'2fa-token'?: string;
	recaptcha?: string;
	generateChallenge?: boolean;
	responseForChallenge?: {
		signature: string | Buffer;
		signAlgorithm: string;
		signEncoding: BinaryToTextEncoding;
	};
}

interface SetTwoFactorAuthenticationContext extends BaseContext {
	password: string;
}

interface ChangePasswordContext extends BaseContext {
	accountId: string;
	oldPassword: string;
	newPassword: string;
	sessionId: number;
}

export { AuthenticationContext, ChangePasswordContext, SetTwoFactorAuthenticationContext, BaseContext };

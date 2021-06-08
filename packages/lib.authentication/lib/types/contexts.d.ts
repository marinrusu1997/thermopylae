import type { HttpDevice, HTTPRequestLocation } from '@thermopylae/core.declarations';
import type { BinaryToTextEncoding } from 'crypto';

interface BaseContext {
	readonly ip: string;
	readonly device?: HttpDevice;
	readonly location?: HTTPRequestLocation;
}

interface AuthenticationContext extends BaseContext {
	readonly username: string;
	readonly password?: string;
	readonly deviceId: string;
	readonly '2fa-token'?: string;
	readonly recaptcha?: string;
	readonly generateChallenge?: boolean;
	readonly responseForChallenge?: {
		readonly signature: string | Buffer;
		readonly signAlgorithm: string;
		readonly signEncoding: BinaryToTextEncoding;
	};
}

interface SetTwoFactorAuthenticationContext extends BaseContext {
	readonly password: string;
}

interface ChangePasswordContext extends BaseContext {
	readonly accountId: string;
	readonly oldPassword: string;
	readonly newPassword: string;
	readonly sessionId: number;
}

export { AuthenticationContext, ChangePasswordContext, SetTwoFactorAuthenticationContext, BaseContext };

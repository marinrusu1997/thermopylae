import type { HttpDevice, HTTPRequestLocation } from '@thermopylae/core.declarations';
import type { BinaryToTextEncoding } from 'crypto';
import { RequireAtLeastOne } from '@thermopylae/core.declarations';

interface BaseContext {
	readonly ip: string;
	readonly device?: HttpDevice;
	readonly location?: HTTPRequestLocation;
}

interface AuthenticationContextInterface extends BaseContext {
	readonly username: string;
	readonly deviceId: string;
	readonly password?: string;
	readonly '2fa-token'?: string;
	readonly generateChallenge?: boolean;
	readonly responseForChallenge?: {
		readonly signature: string | Buffer;
		readonly signAlgorithm: string;
		readonly signEncoding: BinaryToTextEncoding;
	};
	readonly recaptcha?: string;
}
type AuthenticationContext = RequireAtLeastOne<AuthenticationContextInterface, 'password' | '2fa-token' | 'generateChallenge' | 'responseForChallenge'>;

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

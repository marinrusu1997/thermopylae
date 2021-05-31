import type { HttpDevice, HTTPRequestLocation, UnixTimestamp } from '@thermopylae/core.declarations';
import type { TwoFactorAuthOperation } from './enums';

interface UserCredentials {
	username: string;
	password: string;
}

interface AccountModel extends UserCredentials {
	id: string;
	alg: number;
	salt: string;
	email: string;
	telephone?: string;
	enabled: boolean;
	mfa: TwoFactorAuthOperation;
	pubKey?: string | Buffer;
}

interface AuthenticationModelBase {
	id: string;
	accountId: string;
	ip: string;
	device?: HttpDevice | null;
	location?: HTTPRequestLocation | null;
}

interface SuccessfulAuthenticationModel extends AuthenticationModelBase {
	authenticatedAt: UnixTimestamp;
}

interface FailedAuthenticationModel extends AuthenticationModelBase {
	detectedAt: Date;
}

export type { UserCredentials, AccountModel, SuccessfulAuthenticationModel, FailedAuthenticationModel };

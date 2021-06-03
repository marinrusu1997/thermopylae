import type { HttpDevice, HTTPRequestLocation, UnixTimestamp } from '@thermopylae/core.declarations';
import type { AccountStatus } from './enums';

interface UserCredentials {
	username: string;
	password: string;
}

interface AccountModel {
	id: string;
	username: string;
	passwordHash: string;
	/**
	 * Optional, might be encoded in the password hash.
	 */
	passwordSalt?: string;
	passwordAlg: number;
	email: string;
	telephone?: string;
	disabledUntil: UnixTimestamp | AccountStatus;
	mfa?: boolean;
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
	detectedAt: UnixTimestamp;
}

export type { UserCredentials, AccountModel, SuccessfulAuthenticationModel, FailedAuthenticationModel };

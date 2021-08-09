import type { HttpDevice, HTTPRequestLocation, UnixTimestamp } from '@thermopylae/core.declarations';
import type { AccountStatus } from './enums';

interface UserCredentials {
	username: string;
	password: string;
}

/**
 * Model which represents user account.
 * It is managed by {@link AccountRepository}.
 */
interface AccountModel {
	id: string;
	username: string;
	passwordHash: string;
	/**
	 * Optional, might be encoded in the password hash.
	 */
	passwordSalt?: string | null;
	/**
	 * Id of the algorithm used at password hashing.
	 */
	passwordAlg: number;
	email: string;
	telephone?: string | null;
	/**
	 * Account availability status. <br/>
	 * Might be enabled, disabled until activation or disabled until some timestamp.
	 */
	disabledUntil: UnixTimestamp | AccountStatus;
	/**
	 * Whether multi factor authentication is enabled for this account.
	 */
	mfa: boolean;
	/**
	 * Public Key of the account. <br/>
	 * Will be used for different encryption operations.
	 */
	pubKey?: string | null;
}

/**
 * Common definition for authentication model.
 */
interface AuthenticationModelBase {
	/**
	 * Authentication id.
	 */
	id: string;
	/**
	 * Account id.
	 */
	accountId: string;
	/**
	 * Ip from where authentication has been made.
	 */
	ip: string;
	/**
	 * Device from where authentication has been made.
	 */
	device?: HttpDevice | null;
	/**
	 * Location from where authentication has been made.
	 */
	location?: HTTPRequestLocation | null;
}

/**
 * Model which represents successful authentication. <br/>
 * Whenever user successfully authenticates, this model will be persisted by the {@link SuccessfulAuthenticationsRepository}.
 */
interface SuccessfulAuthenticationModel extends AuthenticationModelBase {
	/**
	 * Timestamp of the authentication.
	 */
	authenticatedAt: UnixTimestamp;
}

/**
 * Model which represents failed authentication. <br/>
 * Whenever user fails to authenticate too many times and it's account is disabled as consequence,
 * this model will be persisted by the {@link FailedAuthenticationAttemptsRepository}.
 */
interface FailedAuthenticationModel extends AuthenticationModelBase {
	/**
	 * Timestamp when authentication failure has been detected.
	 */
	detectedAt: UnixTimestamp;
}

export type { UserCredentials, AccountModel, AuthenticationModelBase, SuccessfulAuthenticationModel, FailedAuthenticationModel };

import type { HttpDevice, Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import type { SuccessfulAuthenticationModel, AccountModel, FailedAuthenticationModel } from './models';
import type { AuthenticationSession, FailedAuthenticationAttemptSession, ForgotPasswordSession } from './sessions';
import type { TwoFactorAuthOperation } from './enums';

/**
 * Repository which stores user accounts.
 */
interface AccountRepository<Account extends AccountModel> {
	/**
	 * Inserts a new account. <br/>
	 * Accounts are unique, and therefore in case account already exists, and exception needs to be thrown. <br/>
	 * On successful account insertion, it's generated id needs to be stored in the {@link AccountModel.id} property of the
	 * `account` argument.
	 *
	 * @param account	Account that needs to be inserted.
	 *
	 * @throws {Error}	When account is inserted already or any other error is encountered.
	 */
	insert(account: Account): Promise<void>;

	/**
	 * Read account from repository by his username.
	 *
	 * @param username	Account username.
	 *
	 * @returns		Account entity or null when not found.
	 */
	read(username: string): Promise<Account | null>;

	/**
	 * Read account from repository by his id.
	 *
	 * @param accountId		Account id.
	 *
	 * @returns				Account entity or null when not found.
	 */
	readById(accountId: string): Promise<Account | null>;

	/**
	 * Delete account from repository.
	 *
	 * @param accountId		Account id.
	 *
	 * @returns				Whether account was deleted.
	 */
	delete(accountId: string): Promise<boolean>;

	/**
	 * Change account enable status.
	 *
	 * @param accountId		Account id.
	 * @param isEnabled		Enabled status.
	 *
	 * @throws {Error}		When account is not found or any other error is encountered.
	 */
	setEnabled(accountId: string, isEnabled: boolean): Promise<void>;

	/**
	 * Change account two factor auth status.
	 *
	 * @param accountId					Account id.
	 * @param twoFactorAuthOperation	Two factor auth operation.
	 *
	 * @throws {Error}					When account is not found or any other error is encountered.
	 */
	setTwoFactorAuth(accountId: string, twoFactorAuthOperation: TwoFactorAuthOperation): Promise<void>;

	/**
	 * Change account password.
	 *
	 * @param accountId				Account id.
	 * @param passwordHash			Password hash.
	 * @param salt					Password salt.
	 * @param hashingAlg			Hashing algorithm id.
	 *
	 * @throws {Error}				When account is not found or any other error is encountered.
	 */
	changePassword(accountId: string, passwordHash: string, salt: string, hashingAlg: number): Promise<void>;
}

/**
 * Repository which holds users failed authentication attempts.
 */
interface FailedAuthenticationAttemptsRepository {
	/**
	 * Insert failed auth attempt. <br/>
	 * On successful attempt, {@link FailedAuthenticationModel.id} property should be set on the `attempt` parameter.
	 *
	 * @param attempt		Failed authentication attempt.
	 */
	insert(attempt: FailedAuthenticationModel): Promise<void>;

	/**
	 * Read multiple {@link FailedAuthenticationModel} based on a date range.
	 *
	 * @param accountId			Account id.
	 * @param startingFrom		Starting timestamp.
	 * @param endingTo			Ending timestamp.
	 *
	 * @returns					List of failed authentications.
	 */
	readRange(accountId: string, startingFrom?: UnixTimestamp, endingTo?: UnixTimestamp): Promise<Array<FailedAuthenticationModel>>;
}

/**
 * Repository which holds users successful authentication attempts.
 */
interface SuccessfulAuthenticationsRepository {
	/**
	 * Insert successful authentication attempt.
	 * On successful attempt, {@link SuccessfulAuthenticationModel.id} property should be set on the `authentication` parameter.
	 *
	 * @param authentication	Successful authentication attempt.
	 */
	insert(authentication: SuccessfulAuthenticationModel): Promise<void>;

	/**
	 * Detect whether user made a successful authentication attempt before from this `device`.
	 *
	 * @param accountId		Account id.
	 * @param device		Device from where authentication has been made.
	 *
	 * @returns			Whether authentication has been made before.
	 */
	authBeforeFromThisDevice(accountId: string, device: HttpDevice): Promise<boolean>;
}

/**
 * Repository which holds *on going* user authentication.
 */
interface AuthenticationSessionRepository {
	/**
	 * Insert/Replaces *on going* user authentication session.
	 *
	 * @param username		Account username.
	 * @param deviceId		Id of the device from where authentication is made. <br/>
	 * 						Might be a hash of 'User-Agent' header.
	 * @param session		User authentication session.
	 * @param ttl			Session ttl in seconds. <br/>
	 * 						In case session is already present, when replacing it, ttl needs to be reset too.
	 */
	upsert(username: string, deviceId: string, session: AuthenticationSession, ttl: Seconds): Promise<void>;

	/**
	 * Read *on going* user authentication session.
	 *
	 * @param username		Account username.
	 * @param deviceId		Id of the device from where authentication is made.
	 *
	 * @returns		User authentication session or `null` when not found.
	 */
	read(username: string, deviceId: string): Promise<AuthenticationSession | null>;

	/**
	 * Delete *on going* user authentication session.
	 *
	 * @param username		Account username.
	 * @param deviceId		Id of the device from where authentication is made.
	 */
	delete(username: string, deviceId: string): Promise<void>;
}

/**
 * Repository which holds failed authentication attempts session of the user.
 */
interface FailedAuthAttemptSessionRepository {
	/**
	 * Insert session. <br/>
	 * In case user was inserted already, it needs to be replaced.
	 *
	 * @param username		Account username.
	 * @param session		Failed authentication attempts session.
	 * @param ttl			Session ttl in seconds.
	 */
	insert(username: string, session: FailedAuthenticationAttemptSession, ttl: Seconds): Promise<void>;

	/**
	 * Read failed authentication attempts session.
	 *
	 * @param username		Account username.
	 *
	 * @returns		Failed authentication attempts session or `null` when not found.
	 */
	read(username: string): Promise<FailedAuthenticationAttemptSession | null>;

	/**
	 * Replace failed authentication attempts session. <br/>
	 * In case old session isn't present, it should create it.
	 *
	 * @param username		Account username.
	 * @param session		Updated failed authentication attempts session.
	 */
	replace(username: string, session: FailedAuthenticationAttemptSession): Promise<void>;

	/**
	 * Delete failed authentication attempts session.
	 *
	 * @param username		Account username.
	 */
	delete(username: string): Promise<void>;
}

/**
 * Repository which holds forgot password sessions.
 */
interface ForgotPasswordSessionRepository {
	/**
	 * Insert forgot password session.
	 *
	 * @param token			Forgot password session token.
	 * @param session		Forgot password session.
	 * @param ttl			Session ttl in seconds.
	 */
	insert(token: string, session: ForgotPasswordSession, ttl: Seconds): Promise<void>;

	/**
	 * Read forgot password session.
	 *
	 * @param token		Forgot password session token.
	 *
	 * @returns			Forgot password session or null when not found.
	 */
	read(token: string): Promise<ForgotPasswordSession | null>;

	/**
	 * Delete forgot password session.
	 *
	 * @param token		Forgot password session token.
	 */
	delete(token: string): Promise<void>;
}

export type {
	AccountRepository,
	FailedAuthenticationAttemptsRepository,
	SuccessfulAuthenticationsRepository,
	AuthenticationSessionRepository,
	FailedAuthAttemptSessionRepository,
	ForgotPasswordSessionRepository
};

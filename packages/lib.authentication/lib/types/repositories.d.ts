import type { HttpDevice, Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import type { SuccessfulAuthenticationModel, AccountModel, FailedAuthenticationModel } from './models';
import type { AuthenticationSession, FailedAuthenticationAttemptSession } from './sessions';

/**
 * Repository which stores user accounts.
 */
interface AccountRepository<Account extends AccountModel> {
	/**
	 * Inserts a new account. <br/>
	 * Accounts are unique, and therefore in case account with same {@link AccountModel.username} already exists,
	 * an exception needs to be thrown. <br/>
	 * On successful account insertion, it's generated id needs to be stored in the {@link AccountModel.id} property of the
	 * `account` argument.
	 *
	 * @param account	Account that needs to be inserted.
	 *
	 * @returns 		`null` or `undefined` when account was inserted successfully. <br/>
	 * 					When account has duplicated fields, their names need to be returned inside of array.
	 */
	insert(account: Account): Promise<(keyof Account)[] | null | undefined>;

	/**
	 * Read account from repository by his id.
	 *
	 * @param accountId		Account id.
	 *
	 * @returns				Account entity or null when not found.
	 */
	readById(accountId: string): Promise<Account | null | undefined>;

	/**
	 * Read account from repository by his username.
	 *
	 * @param username	Account username.
	 *
	 * @returns			Account entity or null when not found.
	 */
	readByUsername(username: string): Promise<Account | null | undefined>;

	/**
	 * Read account from repository by his email.
	 *
	 * @param email		Account email.
	 *
	 * @returns			Account entity or null when not found.
	 */
	readByEmail(email: string): Promise<Account | null | undefined>;

	/**
	 * Read account from repository by his telephone number.
	 *
	 * @param telephone	Account telephone.
	 *
	 * @returns			Account entity or null when not found.
	 */
	readByTelephone(telephone: string): Promise<Account | null | undefined>;

	/**
	 * Update account.
	 *
	 * @param accountId		Account id.
	 * @param update		Fields that needs to be updated.
	 *
	 * @throws {Error}		When account is not found or any other error is encountered.
	 */
	update(accountId: string, update: Partial<Account>): Promise<void>;

	/**
	 * Change account enable status.
	 *
	 * @param accountId		Account id.
	 * @param until			Disabled until timestamp.
	 *
	 * @throws {Error}		When account is not found or any other error is encountered.
	 */
	setDisabledUntil(accountId: string, until: UnixTimestamp): Promise<void>;

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
	changePassword(accountId: string, passwordHash: string, salt: string | undefined | null, hashingAlg: number): Promise<void>;

	/**
	 * Detect whether an account having same values for unique fields exists in the repository.
	 *
	 * @param account		Account that needs to be checked whether it has duplicated fields.
	 *
	 * @returns 			`null` or `undefined` when account was inserted successfully. <br/>
	 * 						When account has duplicated fields, their names need to be returned inside of array.
	 */
	isDuplicate(account: Account): Promise<(keyof Account)[] | null | undefined>;
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
	 * Read multiple {@link SuccessfulAuthenticationModel} based on a date range.
	 *
	 * @param accountId			Account id.
	 * @param startingFrom		Starting timestamp.
	 * @param endingTo			Ending timestamp.
	 *
	 * @returns					List of successful authentications.
	 */
	readRange(accountId: string, startingFrom?: UnixTimestamp, endingTo?: UnixTimestamp): Promise<Array<SuccessfulAuthenticationModel>>;

	/**
	 * Detect whether user made a successful authentication attempt before from this `device`.
	 *
	 * @param accountId		Account id.
	 * @param device		Device from where authentication has been made.
	 *
	 * @returns				Whether authentication has been made before.
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
	read(username: string, deviceId: string): Promise<AuthenticationSession | null | undefined>;

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
	 * Insert/Replaces session.
	 *
	 * @param username		Account username.
	 * @param session		Failed authentication attempts session.
	 * @param ttl			Session ttl in seconds. <br/>
	 * 						In case session is already present, when replacing it, ttl needs to be reset too.
	 */
	upsert(username: string, session: FailedAuthenticationAttemptSession, ttl: Seconds): Promise<void>;

	/**
	 * Read failed authentication attempts session.
	 *
	 * @param username		Account username.
	 *
	 * @returns		Failed authentication attempts session or `null` when not found.
	 */
	read(username: string): Promise<FailedAuthenticationAttemptSession | null | undefined>;

	/**
	 * Delete failed authentication attempts session.
	 *
	 * @param username		Account username.
	 */
	delete(username: string): Promise<void>;
}

/**
 * Repository which holds temporary accounts that weren't activated yet.
 */
interface ActivateAccountSessionRepository<Account extends AccountModel> {
	/**
	 * Insert session.
	 *
	 * @param token			Activate account token.
	 * @param account		Account that needs to be activated.
	 * @param ttl			Session ttl in seconds.
	 *
	 * @throws {Error}		When token exists already.
	 */
	insert(token: string, account: Account, ttl: Seconds): Promise<void>;

	/**
	 * Read session.
	 *
	 * @param token		Activate account token.
	 *
	 * @returns			Account that needs to be activated or `null` when token was not valid.
	 */
	read(token: string): Promise<Account | null | undefined>;

	/**
	 * Delete session.
	 *
	 * @param token		Activate account token.
	 */
	delete(token: string): Promise<void>;
}

/**
 * Repository which holds forgot password sessions.
 */
interface ForgotPasswordSessionRepository {
	/**
	 * Insert forgot password session.
	 *
	 * @param token			Forgot password session token.
	 * @param ttl			Session ttl in seconds.
	 *
	 * @throws {Error}		When token exists already.
	 */
	insert(token: string, ttl: Seconds): Promise<void>;

	/**
	 * Check whether forgot password session token exists.
	 *
	 * @param token		Forgot password session token.
	 */
	exists(token: string): Promise<boolean>;

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
	ActivateAccountSessionRepository,
	ForgotPasswordSessionRepository
};

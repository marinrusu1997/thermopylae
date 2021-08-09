import type { HttpDevice, Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import type { SuccessfulAuthenticationModel, AccountModel, FailedAuthenticationModel } from './models';
import type { AuthenticationSession, FailedAuthenticationAttemptSession } from './sessions';

/**
 * Repository which stores user accounts.
 *
 * @template Account	Type of the account.
 */
interface AccountRepository<Account extends AccountModel> {
	/**
	 * Inserts a new account. <br/>
	 * On successful account insertion, it's generated id needs to be stored in the {@link AccountModel.id} property of the
	 * *`account`* argument and *`null`* will be returned. <br/>
	 * It is clear that {@link AccountModel.id}, {@link AccountModel.username}, {@link AccountModel.email}, {@link AccountModel.telephone}
	 * and maybe another properties will be unique ones. Therefore when duplicates are detected,
	 * an array with names of the duplicated properties needs to be returned back.
	 * This will inform {@link AuthenticationEngine} that insertion failed and account registration needs to be aborted.
	 *
	 * @param account	Account that needs to be inserted.
	 *
	 * @throws {Error}	When any problems (excepting duplicated fields) are encountered by the repository.
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
	 * @throws {Error}	When any problems are encountered by the repository.
	 *
	 * @returns				Account entity or null when not found.
	 */
	readById(accountId: string): Promise<Account | null | undefined>;

	/**
	 * Read account from repository by his username.
	 *
	 * @param username	Account username.
	 *
	 * @throws {Error}	When any problems are encountered by the repository.
	 *
	 * @returns			Account entity or null when not found.
	 */
	readByUsername(username: string): Promise<Account | null | undefined>;

	/**
	 * Read account from repository by his email.
	 *
	 * @param email		Account email.
	 *
	 * @throws {Error}	When any problems are encountered by the repository.
	 *
	 * @returns			Account entity or null when not found.
	 */
	readByEmail(email: string): Promise<Account | null | undefined>;

	/**
	 * Read account from repository by his telephone number.
	 *
	 * @param telephone	Account telephone.
	 *
	 * @throws {Error}	When any problems are encountered by the repository.
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
	 * Change account availability status by updating {@link AccountModel.disabledUntil} property.
	 *
	 * @param accountId		Account id.
	 * @param until			Disabled until timestamp.
	 *
	 * @throws {Error}		When account is not found or any other error is encountered.
	 */
	setDisabledUntil(accountId: string, until: UnixTimestamp): Promise<void>;

	/**
	 * Change account password. <br/>
	 * The following properties need to be updated: <br/>
	 * - {@link AccountModel.passwordHash} <br/>
	 * - {@link AccountModel.passwordSalt} <br/>
	 * - {@link AccountModel.passwordAlg}
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
	 * @returns 			`null` or `undefined` when account has no duplicates. <br/>
	 * 						When account has duplicated fields, their names need to be returned inside of array.
	 */
	isDuplicate(account: Account): Promise<(keyof Account)[] | null | undefined>;
}

/**
 * Repository which holds users failed authentication attempts.
 */
interface FailedAuthenticationAttemptsRepository {
	/**
	 * Insert failed authentication. <br/>
	 * On successful authentication, {@link FailedAuthenticationModel.id} property should be set on the `authentication` parameter.
	 *
	 * @param authentication		Failed authentication authentication.
	 */
	insert(authentication: FailedAuthenticationModel): Promise<void>;

	/**
	 * Read multiple {@link FailedAuthenticationModel} based on a date range. <br/>
	 * Depending on the *`startingFrom`* and *`endingTo`* parameters, the following combinations are allowed: <br/>
	 * - return all attempts <br/>
	 * - return all attempts {@link FailedAuthenticationModel.detectedAt} starting from *`startingFrom`* <br/>
	 * - return all attempts {@link FailedAuthenticationModel.detectedAt} ending to *`endingTo`* <br/>
	 * - return all attempts {@link FailedAuthenticationModel.detectedAt} between *`startingFrom`* and *`endingTo`*
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
	 * Read multiple {@link SuccessfulAuthenticationModel} based on a date range. <br/>
	 * Depending on the *`startingFrom`* and *`endingTo`* parameters, the following combinations are allowed: <br/>
	 * - return all attempts <br/>
	 * - return all attempts {@link SuccessfulAuthenticationModel.authenticatedAt} starting from *`startingFrom`* <br/>
	 * - return all attempts {@link SuccessfulAuthenticationModel.authenticatedAt} ending to *`endingTo`* <br/>
	 * - return all attempts {@link SuccessfulAuthenticationModel.authenticatedAt} between *`startingFrom`* and *`endingTo`*
	 *
	 * @param accountId			Account id.
	 * @param startingFrom		Starting timestamp.
	 * @param endingTo			Ending timestamp.
	 *
	 * @returns					List of successful authentications.
	 */
	readRange(accountId: string, startingFrom?: UnixTimestamp, endingTo?: UnixTimestamp): Promise<Array<SuccessfulAuthenticationModel>>;

	/**
	 * Detect whether user has made a successful authentication attempt in the past from this *`device`*.
	 *
	 * @param accountId		Account id.
	 * @param device		Device from where current authentication has been made.
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
	 * @param deviceId		Id of the device from where authentication is made.
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
	 * @returns				User authentication session or *`null`* when not found.
	 */
	read(username: string, deviceId: string): Promise<AuthenticationSession | null | undefined>;

	/**
	 * Delete *on going* user authentication session. <br/>
	 * In case session with `username` and `deviceId` doesn't exist,
	 * this needs to be **shallowly ignored** and operation will be considered successful.
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
	 * @returns				Failed authentication attempts session or `null` when not found.
	 */
	read(username: string): Promise<FailedAuthenticationAttemptSession | null | undefined>;

	/**
	 * Delete failed authentication attempts session. <br/>
	 * In case session with `username` doesn't exist, this needs to be **shallowly ignored** and operation will be considered successful.
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
	 * @returns			Account that needs to be activated or `null` when token was not found.
	 */
	read(token: string): Promise<Account | null | undefined>;

	/**
	 * Delete session. <br/>
	 * In case token doesn't exist, this needs to be **shallowly ignored** and operation will be considered successful.
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
	 * Delete forgot password session. <br/>
	 * In case token doesn't exist, this needs to be **shallowly ignored** and operation will be considered successful.
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

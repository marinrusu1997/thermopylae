import { AuthenticationEntryPointModel, AccountModel, FailedAuthAttemptsModel, ActiveUserSession } from './models';
import { OnGoingAuthenticationSession, FailedAuthenticationAttemptSession, ActivateAccountSession, ForgotPasswordSession } from './sessions';

export interface AccountEntity {
	create(account: AccountModel): Promise<string>;
	read(username: string): Promise<AccountModel | null>;
	readById(id: string): Promise<AccountModel | null>;
	enable(id: string): Promise<void>;
	disable(id: string): Promise<void>;
	enableMultiFactorAuth(id: string): Promise<void>;
	disableMultiFactorAuth(id: string): Promise<void>;
	changePassword(id: string, passwordHash: string, salt: string): Promise<void>;
	delete(id: string): Promise<void>;
}

export interface FailedAuthenticationAttemptsEntity {
	create(attempts: FailedAuthAttemptsModel): Promise<string>;
	readRange(accountId: string, startingFrom?: Date, endingTo?: Date): Promise<Array<FailedAuthAttemptsModel>>;
}

export interface AuthenticationEntryPointEntity {
	create(authenticationEntryPoint: AuthenticationEntryPointModel): Promise<void>;
	authBeforeFromThisDevice(accountId: string, device: string): Promise<boolean>;
}

export interface ActiveUserSessionEntity {
	create(session: ActiveUserSession): Promise<void>;
	readAll(accountId: string): Promise<Array<ActiveUserSession & AuthenticationEntryPointModel>>;
	readAllButOne(accountId: string, exceptedSessionId: number): Promise<Array<ActiveUserSession & AuthenticationEntryPointModel>>;
	delete(accountId: string, timestamp: number): Promise<void>;
	deleteAll(accountId: string): Promise<number>;
	deleteAllButOne(accountId: string, exceptedSessionId: number): Promise<number>;
}

export interface AuthSessionEntity {
	create(username: string, deviceId: string, session: OnGoingAuthenticationSession, ttl: number): Promise<void>;
	read(username: string, deviceId: string): Promise<OnGoingAuthenticationSession | null>;
	update(username: string, deviceId: string, session: OnGoingAuthenticationSession): Promise<void>;
	delete(username: string, deviceId: string): Promise<void>;
}

export interface FailedAuthAttemptSessionEntity {
	create(username: string, session: FailedAuthenticationAttemptSession, ttl: number): Promise<void>;
	read(username: string): Promise<FailedAuthenticationAttemptSession | null>;
	update(username: string, session: FailedAuthenticationAttemptSession): Promise<void>;
	delete(username: string): Promise<void>;
}

export interface ActivateAccountSessionEntity {
	create(token: string, session: ActivateAccountSession, ttl: number): Promise<void>;
	read(token: string): Promise<ActivateAccountSession | null>;
	delete(token: string): Promise<void>;
}

export interface ForgotPasswordSessionEntity {
	create(token: string, session: ForgotPasswordSession, ttl: number): Promise<void>;
	read(token: string): Promise<ForgotPasswordSession | null>;
	delete(token: string): Promise<void>;
}

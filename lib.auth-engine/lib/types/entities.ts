import { AccessPointModel, AccountModel, FailedAuthAttemptsModel } from './models';
import { AuthSession, FailedAuthAttemptSession, ActiveUserSession, ActivateAccountSession, ForgotPasswordSession } from './sessions';

export interface AccountEntity {
	create(account: AccountModel): Promise<AccountModel>;
	read(username: string): Promise<AccountModel | null>;
	readById(id: string): Promise<AccountModel | null>;
	delete(id: string): Promise<void>;
	activate(id: string): Promise<void>;
	lock(id: string): Promise<void>;
	unlock(id: string): Promise<void>;
	activateMFA(id: string, activate: boolean): Promise<void>;
	changePassword(id: string, passwordHash: string, salt: string): Promise<void>;
}

export interface FailedAuthAttemptsEntity {
	create(attempts: FailedAuthAttemptsModel): Promise<string>;
	readRange(accountId: string, startingFrom?: number, endingTo?: number): Promise<Array<FailedAuthAttemptsModel>>;
}

export interface AccessPointEntity {
	create(accessPoint: AccessPointModel): Promise<void>;
	authBeforeFromThisDevice(accountId: string, device: string): Promise<boolean>;
}

export interface ActiveUserSessionEntity {
	create(session: ActiveUserSession): Promise<void>;
	readAll(accountId: string): Promise<Array<ActiveUserSession & AccessPointModel>>;
	readAllButOne(accountId: string, exceptedSessionId: number): Promise<Array<ActiveUserSession & AccessPointModel>>;
	delete(accountId: string, timestamp: number): Promise<void>;
	deleteAll(accountId: string): Promise<number>;
	deleteAllButOne(accountId: string, exceptedSessionId: number): Promise<number>;
}

export interface AuthSessionEntity {
	create(username: string, deviceId: string, ttl: number): Promise<AuthSession>;
	update(username: string, deviceId: string, session: AuthSession): Promise<void>;
	read(username: string, deviceId: string): Promise<AuthSession | null>;
	delete(username: string, deviceId: string): Promise<void>;
}

export interface FailedAuthAttemptSessionEntity {
	create(username: string, session: FailedAuthAttemptSession, ttl: number): Promise<void>;
	update(username: string, session: FailedAuthAttemptSession): Promise<void>;
	read(username: string): Promise<FailedAuthAttemptSession | null>;
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

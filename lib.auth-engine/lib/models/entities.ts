import { AccessPoint, Account, FailedAuthAttempts } from './index';
import { AuthSession, FailedAuthAttemptSession, ActiveUserSession, ActivateAccountSession } from './sessions';

export interface AccountEntity {
	create(account: Account): Promise<Account>;
	read(username: string): Promise<Account | null>;
	readById(id: string): Promise<Account | null>;
	delete(id: string): Promise<void>;
	activate(id: string): Promise<void>;
	lock(id: string): Promise<void>;
	requireMfa(id: string, required: boolean): Promise<void>;
}

export interface FailedAuthAttemptsEntity {
	create(attempts: FailedAuthAttempts): Promise<string>;
	readRange(accountId: string, startingFrom?: number, endingTo?: number): Promise<Array<FailedAuthAttempts>>;
}

export interface AccessPointEntity {
	create(accessPoint: AccessPoint): Promise<void>;
	authBeforeFromThisDevice(accountId: string, device: string): Promise<boolean>;
}

export interface ActiveUserSessionEntity {
	create(session: ActiveUserSession): Promise<void>;
	readAll(accountId: string): Promise<Array<ActiveUserSession & AccessPoint>>;
	delete(accountId: string, timestamp: number): Promise<void>;
	deleteAll(accountId: string): Promise<number>;
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

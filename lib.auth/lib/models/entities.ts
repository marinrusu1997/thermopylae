import { AccessPoint, Account, FailedAuthAttempts } from './index';
import { Id } from '../types';
import { AuthSession, FailedAuthAttemptSession, UserSession } from './sessions';

export interface AccountEntity {
	create: (account: Account) => Promise<Account>;
	read: (username: string) => Promise<Account | null>;
	readById: (id: Id) => Promise<Account | null>;
	update: (account: Account) => Promise<void>;
	activate: (id: Id) => Promise<void>;
	lock: (id: Id) => Promise<void>;
	requireMfa: (id: Id, required: boolean) => Promise<void>;
}

export interface FailedAuthAttemptsEntity {
	create: (attempts: FailedAuthAttempts) => Promise<number>;
	readRange: (accountId: Id, startingFrom?: number, endingTo?: number) => Promise<Array<FailedAuthAttempts>>;
}

export interface AuthSessionEntity {
	create: (username: string, deviceId: string, ttl: number) => Promise<AuthSession>;
	update: (username: string, deviceId: string, session: AuthSession) => Promise<void>;
	read: (username: string, deviceId: string) => Promise<AuthSession | null>;
	delete: (username: string, deviceId: string) => Promise<void>;
}

export interface AccessPointEntity {
	create: (accessPoint: AccessPoint) => Promise<void>;
	authBeforeFromThisDevice: (accountId: Id, device: string) => Promise<boolean>;
}

export interface FailedAuthAttemptSessionEntity {
	create: (username: string, session: FailedAuthAttemptSession, ttl: number) => Promise<void>;
	update: (username: string, session: FailedAuthAttemptSession) => Promise<void>;
	read: (username: string) => Promise<FailedAuthAttemptSession | null>;
	delete: (username: string) => Promise<void>;
}

export interface ActiveUserSessionEntity {
	create: (session: UserSession) => Promise<void>;
	readAll: (accountId: Id) => Promise<Array<UserSession>>;
	delete: (id: number) => Promise<number>;
	deleteAll: (accountId: Id) => Promise<number>;
}

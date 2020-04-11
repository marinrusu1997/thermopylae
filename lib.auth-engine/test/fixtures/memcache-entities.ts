import { getDefaultMemCache } from '@marin/lib.memcache';
import { ActivateAccountSessionEntity, AuthSessionEntity, FailedAuthAttemptSessionEntity, ForgotPasswordSessionEntity } from '../../lib/types/entities';
import { OnGoingAuthenticationSession, FailedAuthenticationAttemptSession } from '../../lib/types/sessions';

const memcache = getDefaultMemCache();

enum SESSIONS_OP {
	ACTIVATE_ACCOUNT_SESSION_CREATE,
	ACTIVATE_ACCOUNT_SESSION_DELETE,
	FAILED_AUTH_ATTEMPTS_SESSION_DELETE,
	FORGOT_PASSWORD_SESSION_DELETE
}
const failures = new Map<SESSIONS_OP, boolean>();

const AuthSessionEntityMemCache: AuthSessionEntity = {
	/**
	 * @param username
	 * @param deviceId
	 * @param session
	 * @param ttl 		Time to live in minutes
	 */
	create: (username, deviceId, session, ttl) => {
		const key = `auths:${username}:${deviceId}`;
		memcache.set(key, session, ttl * 60); // convert from minutes to seconds
		return Promise.resolve();
	},
	read: (username, deviceId) => {
		const key = `auths:${username}:${deviceId}`;
		const session = memcache.get(key) as OnGoingAuthenticationSession;
		return Promise.resolve(session || null);
	},
	update: (username, deviceId, session) => {
		const key = `auths:${username}:${deviceId}`;
		if (!memcache.replace(key, session)) {
			throw new Error('Failed to update session');
		}
		return Promise.resolve();
	},
	delete: (username, deviceId) => {
		const key = `auths:${username}:${deviceId}`;
		if (!memcache.del(key)) {
			throw new Error('Failed to delete auth session');
		}
		return Promise.resolve();
	}
};

const FailedAuthAttemptSessionEntityMemCache: FailedAuthAttemptSessionEntity = {
	/**
	 * @param username
	 * @param session
	 * @param ttl		Time to live in minutes
	 */
	create: (username, session, ttl) => {
		const key = `faas:${username}`;
		memcache.set(key, session, ttl * 60); // convert from minutes to seconds
		return Promise.resolve();
	},
	read: username => {
		const key = `faas:${username}`;
		const session = memcache.get(key) as FailedAuthenticationAttemptSession;
		return Promise.resolve(session || null);
	},
	update: (username, session) => {
		const key = `faas:${username}`;
		if (!memcache.replace(key, session)) {
			throw new Error('Failed to update session');
		}
		return Promise.resolve();
	},
	delete: username => {
		return new Promise((resolve, reject) => {
			if (failures.get(SESSIONS_OP.FAILED_AUTH_ATTEMPTS_SESSION_DELETE)) {
				return reject(new Error('Delete of failed auth attempts session was configured to fail.'));
			}
			const key = `faas:${username}`;
			if (!memcache.del(key)) {
				return reject(new Error('Failed to delete failed auth attempts session'));
			}
			return resolve();
		});
	}
};

const ActivateAccountSessionEntityMemCache: ActivateAccountSessionEntity = {
	/**
	 * @param token
	 * @param session
	 * @param ttl		Time to live in minutes
	 */
	create: (token, session, ttl) => {
		if (failures.get(SESSIONS_OP.ACTIVATE_ACCOUNT_SESSION_CREATE)) {
			throw new Error('Creation of activate account session was configured to fail.');
		}

		const key = `actacc:${token}`;
		memcache.set(key, session, ttl * 60); // convert from minutes to seconds
		return Promise.resolve();
	},
	read: token => {
		const key = `actacc:${token}`;
		const session = memcache.get(key);
		return Promise.resolve(session || null);
	},
	delete: token => {
		return new Promise<void>((resolve, reject) => {
			if (failures.get(SESSIONS_OP.ACTIVATE_ACCOUNT_SESSION_DELETE)) {
				return reject(new Error('Deletion of activate account session was configured to fail.'));
			}

			const key = `actacc:${token}`;
			if (!memcache.del(key)) {
				return reject(new Error('Failed to delete activate account session'));
			}

			return resolve();
		});
	}
};

const ForgotPasswordSessionEntityMemCache: ForgotPasswordSessionEntity = {
	/**
	 * @param token
	 * @param session
	 * @param ttl		Time to live in minutes
	 */
	create: async (token, session, ttl) => {
		const key = `fgtpswd:${token}`;
		memcache.set(key, session, ttl * 60);
	},
	read: async token => {
		const key = `fgtpswd:${token}`;
		return memcache.get(key) || null;
	},
	delete: async token => {
		if (failures.get(SESSIONS_OP.FORGOT_PASSWORD_SESSION_DELETE)) {
			throw new Error('Deletion of forgot password session was configured to fail');
		}

		const key = `fgtpswd:${token}`;
		memcache.del(key);
	}
};

function hasAnySessions(): boolean {
	return memcache.keys().length !== 0;
}

function failureWillBeGeneratedForSessionOperation(op: SESSIONS_OP, willFail = true): void {
	failures.set(op, willFail);
}

function clearOperationFailuresForSessions(): void {
	failures.clear();
}

export default memcache;
export {
	AuthSessionEntityMemCache,
	FailedAuthAttemptSessionEntityMemCache,
	ActivateAccountSessionEntityMemCache,
	ForgotPasswordSessionEntityMemCache,
	hasAnySessions,
	failureWillBeGeneratedForSessionOperation,
	clearOperationFailuresForSessions,
	SESSIONS_OP
};

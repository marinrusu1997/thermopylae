import { getDefaultMemCache } from '@marin/lib.memcache';
import { AuthSessionEntity, FailedAuthAttemptSessionEntity } from '../../lib/models/entities';
import { AuthSession, FailedAuthAttemptSession } from '../../lib/models/sessions';

const memcache = getDefaultMemCache();

const AuthSessionEntityMemCache: AuthSessionEntity = {
	create: (username, deviceId, ttl) => {
		const key = `auths:${username}:${deviceId}`;
		const session: AuthSession = {
			recaptchaRequired: false
		};
		memcache.set(key, session, ttl);
		return Promise.resolve(session);
	},
	read: (username, deviceId) => {
		const key = `auths:${username}:${deviceId}`;
		const session = memcache.get(key) as AuthSession;
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
			throw new Error('Failed to delete session');
		}
		return Promise.resolve();
	}
};

const FailedAuthAttemptSessionEntityMemCache: FailedAuthAttemptSessionEntity = {
	create: (username, session, ttl) => {
		const key = `faas:${username}`;
		memcache.set(key, session, ttl);
		return Promise.resolve();
	},
	read: username => {
		const key = `faas:${username}`;
		const session = memcache.get(key) as FailedAuthAttemptSession;
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
		const key = `faas:${username}`;
		if (!memcache.del(key)) {
			throw new Error('Failed to delete session');
		}
		return Promise.resolve();
	}
};

export { AuthSessionEntityMemCache, FailedAuthAttemptSessionEntityMemCache };

import { FailedAuthAttemptSessionRepository } from '../../../../lib';
import { MemoryCache } from '../../memory-cache';

const FailedAuthAttemptSessionMemoryRepository: FailedAuthAttemptSessionRepository = {
	insert: async (username, session, ttl) => {
		MemoryCache.set(`failed-auth:${username}`, session, { expiresAfter: ttl });
	},
	read: async (username) => {
		return MemoryCache.get(`failed-auth:${username}`);
	},
	delete: async (username) => {
		MemoryCache.del(`failed-auth:${username}`);
	},
	replace: async (username, session) => {
		MemoryCache.set(`failed-auth:${username}`, session);
	}
};
Object.freeze(FailedAuthAttemptSessionMemoryRepository);

export { FailedAuthAttemptSessionMemoryRepository };

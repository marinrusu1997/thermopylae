import { FailedAuthAttemptSessionRepository } from '../../../../lib';
import { MemoryCache } from '../../memory-cache';

const FailedAuthAttemptSessionMemoryRepository: FailedAuthAttemptSessionRepository = {
	upsert: async (username, session, ttl) => {
		MemoryCache.set(`failed-auth:${username}`, session, { expiresAfter: ttl });
	},
	read: async (username) => {
		return MemoryCache.get(`failed-auth:${username}`) || null;
	},
	delete: async (username) => {
		MemoryCache.del(`failed-auth:${username}`);
	}
};
Object.freeze(FailedAuthAttemptSessionMemoryRepository);

export { FailedAuthAttemptSessionMemoryRepository };

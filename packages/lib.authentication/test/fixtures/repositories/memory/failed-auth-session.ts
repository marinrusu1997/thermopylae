import type { FailedAuthAttemptSessionRepository } from '../../../../lib/index.js';
import { MemoryCache } from '../../memory-cache.js';

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

import type { AuthenticationSessionRepository } from '../../../../lib/index.js';
import { MemoryCache } from '../../memory-cache.js';

const AuthenticationSessionMemoryRepository: AuthenticationSessionRepository = {
	upsert: async (username, deviceId, session, ttl) => {
		MemoryCache.set(`auth:${username}:${deviceId}`, session, { expiresAfter: ttl });
	},
	read: async (username, deviceId) => {
		return MemoryCache.get(`auth:${username}:${deviceId}`) || null;
	},
	delete: async (username, deviceId) => {
		MemoryCache.del(`auth:${username}:${deviceId}`);
	}
};
Object.freeze(AuthenticationSessionMemoryRepository);

export { AuthenticationSessionMemoryRepository };

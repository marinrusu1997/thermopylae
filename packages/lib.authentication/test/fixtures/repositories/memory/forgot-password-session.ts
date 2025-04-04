import type { ForgotPasswordSessionRepository } from '../../../../lib/index.js';
import { MemoryCache } from '../../memory-cache.js';

const ForgotPasswordSessionMemoryRepository: ForgotPasswordSessionRepository = {
	insert: async (token, ttl) => {
		MemoryCache.set(`fgt-pwd:${token}`, null, { expiresAfter: ttl });
	},
	exists: async (token) => {
		return MemoryCache.has(`fgt-pwd:${token}`);
	},
	delete: async (token) => {
		MemoryCache.del(`fgt-pwd:${token}`);
	}
};
Object.freeze(ForgotPasswordSessionMemoryRepository);

export { ForgotPasswordSessionMemoryRepository };

import type { AccountWithTotpSecret, ActivateAccountSessionRepository } from '../../../../lib';
import { MemoryCache } from '../../memory-cache';

const ActivateAccountSessionMemoryRepository: ActivateAccountSessionRepository<AccountWithTotpSecret> = {
	insert: async (token, account, ttl) => {
		MemoryCache.set(`act-acc:${token}`, account, { expiresAfter: ttl });
	},
	read: async (token) => {
		return MemoryCache.get(`act-acc:${token}`) || null;
	},
	delete: async (token) => {
		MemoryCache.del(`act-acc:${token}`);
	}
};
Object.freeze(ActivateAccountSessionMemoryRepository);

export { ActivateAccountSessionMemoryRepository };

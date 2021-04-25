import {
	PolicyBasedCache,
	AbsoluteExpirationPolicyArgumentsBundle,
	BucketGarbageCollector,
	EsMapCacheBackend,
	ProactiveExpirationPolicy,
	CacheEvent
} from '@thermopylae/lib.cache';
import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { chrono } from '@thermopylae/lib.utils';
import { RefreshTokensStorage } from '../../lib/invalidation';

class RefreshTokensStorageAdapter implements RefreshTokensStorage {
	private readonly cache: PolicyBasedCache<string, UnixTimestamp, AbsoluteExpirationPolicyArgumentsBundle>;

	private readonly userSessions: Map<string, Set<string>>;

	public constructor() {
		const backend = new EsMapCacheBackend<string, UnixTimestamp>();
		const policies = [new ProactiveExpirationPolicy<string, UnixTimestamp>(new BucketGarbageCollector())];
		this.cache = new PolicyBasedCache(backend, policies);

		this.userSessions = new Map<string, Set<string>>();

		this.cache.on(CacheEvent.DELETE, (key) => {
			const [user, token] = key.split('@');
			const sessions = this.userSessions.get(user)!;

			sessions.delete(token);
			if (sessions.size === 0) {
				this.userSessions.delete(user);
			}
		});
	}

	public async set(subject: string, refreshToken: string, ttl: Seconds): Promise<void> {
		let sessions = this.userSessions.get(subject);
		if (sessions == null) {
			sessions = new Set<string>();
			this.userSessions.set(subject, sessions);
		}

		sessions.add(refreshToken);
		this.cache.set(`${subject}@${refreshToken}`, chrono.unixTime() + ttl, { expiresAfter: ttl });
	}

	public async has(subject: string, refreshToken: string): Promise<boolean> {
		return this.cache.has(`${subject}@${refreshToken}`);
	}

	public async delete(subject: string, refreshToken: string): Promise<void> {
		this.cache.del(`${subject}@${refreshToken}`);
	}

	public async deleteAll(subject: string): Promise<number> {
		const sessions = Array.from(this.userSessions.get(subject) || new Set());

		for (const session of sessions) {
			this.cache.del(`${subject}@${session}`);
		}

		return sessions.length;
	}
}

export { RefreshTokensStorageAdapter };

import {
	PolicyBasedCache,
	AbsoluteExpirationPolicyArgumentsBundle,
	BucketGarbageCollector,
	EsMapCacheBackend,
	ProactiveExpirationPolicy,
	CacheEvent
} from '@thermopylae/lib.cache';
import { Seconds } from '@thermopylae/core.declarations';
import { RefreshTokensStorage } from '../../lib/invalidation';
import { DeviceBase, UserSessionMetaData } from '../../lib/declarations';

class RefreshTokensStorageAdapter implements RefreshTokensStorage<DeviceBase, string> {
	private readonly cache: PolicyBasedCache<string, UserSessionMetaData<DeviceBase, string>, AbsoluteExpirationPolicyArgumentsBundle>;

	private readonly userSessions: Map<string, Set<string>>;

	public constructor() {
		const backend = new EsMapCacheBackend<string, UserSessionMetaData<DeviceBase, string>>();
		const policies = [new ProactiveExpirationPolicy<string, UserSessionMetaData<DeviceBase, string>>(new BucketGarbageCollector())];
		this.cache = new PolicyBasedCache(backend, policies);

		this.userSessions = new Map<string, Set<string>>();

		this.cache.on(CacheEvent.DELETE, (key) => {
			const [user, token] = key.split('@');
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const sessions = this.userSessions.get(user)!;

			sessions.delete(token);
			if (sessions.size === 0) {
				this.userSessions.delete(user);
			}
		});
	}

	public async insert(subject: string, refreshToken: string, metaData: UserSessionMetaData<DeviceBase, string>, ttl: Seconds): Promise<void> {
		let sessions = this.userSessions.get(subject);
		if (sessions == null) {
			sessions = new Set<string>();
			this.userSessions.set(subject, sessions);
		}

		sessions.add(refreshToken);
		this.cache.set(`${subject}@${refreshToken}`, metaData, { expiresAfter: ttl });
	}

	public async read(subject: string, refreshToken: string): Promise<UserSessionMetaData<DeviceBase, string> | undefined> {
		return this.cache.get(`${subject}@${refreshToken}`);
	}

	public async readAll(subject: string): Promise<Array<UserSessionMetaData<DeviceBase, string>>> {
		const sessions = this.userSessions.get(subject);
		if (sessions == null) {
			return [];
		}

		const sessionsMetaData = new Array<UserSessionMetaData<DeviceBase, string>>(sessions.size);
		let i = 0;
		for (const refreshToken of sessions) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion, no-plusplus
			sessionsMetaData[i++] = this.cache.get(`${subject}@${refreshToken}`)!;
		}
		return sessionsMetaData;
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

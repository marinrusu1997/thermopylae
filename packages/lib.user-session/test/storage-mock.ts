import type { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import {
	PolicyBasedCache,
	AbsoluteExpirationPolicyArgumentsBundle,
	BucketGarbageCollector,
	EsMapCacheBackend,
	ProactiveExpirationPolicy,
	CacheEvent
} from '@thermopylae/lib.cache';
import type { SessionId, DeviceBase } from '@thermopylae/lib.user-session.commons';
import type { UserSessionMetaData, UserSessionsStorage } from '../lib';

class StorageMock implements UserSessionsStorage<DeviceBase, string> {
	private readonly cache: PolicyBasedCache<string, UserSessionMetaData<DeviceBase, string>, AbsoluteExpirationPolicyArgumentsBundle>;

	private readonly userSessions: Map<string, Set<string>>;

	public readonly invocations: Map<keyof StorageMock, number>;

	public constructor() {
		const backend = new EsMapCacheBackend<string, UserSessionMetaData<DeviceBase, string>>();
		const policies = [new ProactiveExpirationPolicy<string, UserSessionMetaData<DeviceBase, string>>(new BucketGarbageCollector())];
		this.cache = new PolicyBasedCache(backend, policies);

		this.userSessions = new Map<string, Set<string>>();

		this.cache.on(CacheEvent.DELETE, (sessionIdKey) => {
			const [subject, sessionId] = StorageMock.decodeSessionIdKey(sessionIdKey);

			const sessions = this.userSessions.get(subject)!;

			sessions.delete(sessionId);
			if (sessions.size === 0) {
				this.userSessions.delete(subject);
			}
		});

		this.invocations = new Map<keyof StorageMock, number>([
			['insert', 0],
			['read', 0],
			['readAll', 0],
			['updateAccessedAt', 0],
			['delete', 0],
			['deleteAll', 0]
		]);
	}

	public async insert(subject: string, sessionId: SessionId, metaData: UserSessionMetaData<DeviceBase, string>, ttl: Seconds): Promise<void> {
		let sessions = this.userSessions.get(subject);
		if (sessions == null) {
			sessions = new Set<string>();
			this.userSessions.set(subject, sessions);
		}

		sessions.add(sessionId);
		this.cache.set(StorageMock.sessionIdKey(subject, sessionId), metaData, { expiresAfter: ttl });
	}

	public async read(subject: string, sessionId: SessionId): Promise<UserSessionMetaData<DeviceBase, string> | undefined> {
		return this.cache.get(StorageMock.sessionIdKey(subject, sessionId));
	}

	public async readAll(subject: string): Promise<ReadonlyMap<SessionId, Readonly<UserSessionMetaData<DeviceBase, string>>>> {
		const sessions = this.userSessions.get(subject);
		if (sessions == null) {
			return new Map();
		}

		const sessionsMetaData = new Map<SessionId, UserSessionMetaData<DeviceBase, string>>();
		for (const sessionId of sessions) {
			sessionsMetaData.set(sessionId, this.cache.get(StorageMock.sessionIdKey(subject, sessionId))!);
		}
		return sessionsMetaData;
	}

	public async updateAccessedAt(subject: string, sessionId: SessionId, accessedAt: UnixTimestamp): Promise<void> {
		const session = this.cache.get(StorageMock.sessionIdKey(subject, sessionId));
		if (session == null) {
			throw new Error(`Session ${sessionId} not found.`);
		}
		session.accessedAt = accessedAt;
	}

	public async delete(subject: string, sessionId: SessionId): Promise<void> {
		this.invocations.set('delete', this.invocations.get('delete')! + 1);
		this.cache.del(StorageMock.sessionIdKey(subject, sessionId));
	}

	public async deleteAll(subject: string): Promise<number> {
		const sessions = Array.from(this.userSessions.get(subject) || new Set<string>());

		for (const sessionId of sessions) {
			this.cache.del(StorageMock.sessionIdKey(subject, sessionId));
		}

		return sessions.length;
	}

	private static sessionIdKey(subject: string, sessionId: SessionId): string {
		return `${subject}:${sessionId}`;
	}

	private static decodeSessionIdKey(sessionIdKey: string): [string, SessionId] {
		return sessionIdKey.split(':') as [string, SessionId];
	}
}

export { StorageMock };

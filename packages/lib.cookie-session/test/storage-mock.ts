import { Seconds } from '@thermopylae/core.declarations';
import {
	PolicyBasedCache,
	AbsoluteExpirationPolicyArgumentsBundle,
	BucketGarbageCollector,
	EsMapCacheBackend,
	ProactiveExpirationPolicy,
	CacheEvent
} from '@thermopylae/lib.cache';
import type { SessionId, UserSessionMetaData, SessionsStorage, DeviceBase } from '../lib';

class StorageMock implements SessionsStorage<DeviceBase, string> {
	private readonly cache: PolicyBasedCache<string, UserSessionMetaData<DeviceBase, string>, AbsoluteExpirationPolicyArgumentsBundle>;

	private readonly userSessions: Map<string, Set<string>>;

	public readonly invocations: Map<keyof StorageMock, number>;

	public constructor() {
		const backend = new EsMapCacheBackend<string, UserSessionMetaData<DeviceBase, string>>();
		const policies = [new ProactiveExpirationPolicy<string, UserSessionMetaData<DeviceBase, string>>(new BucketGarbageCollector())];
		this.cache = new PolicyBasedCache(backend, policies);

		this.userSessions = new Map<string, Set<string>>();

		this.cache.on(CacheEvent.DELETE, (sessionId, metaData) => {
			const sessions = this.userSessions.get(metaData.subject)!;

			sessions.delete(sessionId);
			if (sessions.size === 0) {
				this.userSessions.delete(metaData.subject);
			}
		});

		this.invocations = new Map<keyof StorageMock, number>([
			['insert', 0],
			['read', 0],
			['readAll', 0],
			['update', 0],
			['delete', 0],
			['deleteAll', 0]
		]);
	}

	public async insert(sessionId: SessionId, metaData: UserSessionMetaData<DeviceBase, string>, ttl: Seconds): Promise<void> {
		let sessions = this.userSessions.get(metaData.subject);
		if (sessions == null) {
			sessions = new Set<string>();
			this.userSessions.set(metaData.subject, sessions);
		}

		sessions.add(sessionId);
		this.cache.set(sessionId, metaData, { expiresAfter: ttl });
	}

	public async read(sessionId: SessionId): Promise<UserSessionMetaData<DeviceBase, string> | undefined> {
		return this.cache.get(sessionId);
	}

	public async readAll(subject: string): Promise<ReadonlyMap<SessionId, Readonly<UserSessionMetaData<DeviceBase, string>>>> {
		const sessions = this.userSessions.get(subject);
		if (sessions == null) {
			return new Map();
		}

		const sessionsMetaData = new Map<SessionId, UserSessionMetaData<DeviceBase, string>>();
		for (const sessionId of sessions) {
			sessionsMetaData.set(sessionId, this.cache.get(sessionId)!);
		}
		return sessionsMetaData;
	}

	public async update(sessionId: SessionId, metaData: Partial<UserSessionMetaData<DeviceBase, string>>): Promise<void> {
		const session = this.cache.get(sessionId);
		if (session == null) {
			throw new Error(`Session ${sessionId} not found.`);
		}
		session.accessedAt = metaData.accessedAt!;
	}

	public async delete(sessionId: SessionId): Promise<void> {
		this.invocations.set('delete', this.invocations.get('delete')! + 1);
		this.cache.del(sessionId);
	}

	public async deleteAll(subject: string): Promise<number> {
		const sessions = Array.from(this.userSessions.get(subject) || new Set<string>());

		for (const session of sessions) {
			this.cache.del(session);
		}

		return sessions.length;
	}
}

export { StorageMock };

import { Seconds } from '@thermopylae/core.declarations';
import {
	PolicyBasedCache,
	AbsoluteExpirationPolicyArgumentsBundle,
	BucketGarbageCollector,
	EsMapCacheBackend,
	ProactiveExpirationPolicy,
	CacheEvent
} from '@thermopylae/lib.cache';
import { SessionId, SessionMetaData, SessionsStorage } from '../lib';

class StorageMock implements SessionsStorage {
	private readonly cache: PolicyBasedCache<string, SessionMetaData, AbsoluteExpirationPolicyArgumentsBundle>;

	private readonly userSessions: Map<string, Set<string>>;

	public readonly invocations: Map<keyof StorageMock, number>;

	public constructor() {
		const backend = new EsMapCacheBackend<string, SessionMetaData>();
		const policies = [new ProactiveExpirationPolicy<string, SessionMetaData>(new BucketGarbageCollector())];
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

	public async insert(sessionId: SessionId, metaData: SessionMetaData, ttl: Seconds): Promise<void> {
		let sessions = this.userSessions.get(metaData.subject);
		if (sessions == null) {
			sessions = new Set<string>();
			this.userSessions.set(metaData.subject, sessions);
		}

		sessions.add(sessionId);
		this.cache.set(sessionId, metaData, { expiresAfter: ttl });
	}

	public async read(sessionId: SessionId): Promise<SessionMetaData | undefined> {
		return this.cache.get(sessionId);
	}

	public async readAll(subject: string): Promise<Array<Readonly<SessionMetaData>>> {
		const sessions = this.userSessions.get(subject);
		if (sessions == null) {
			return [];
		}

		const sessionsMetaData = new Array<SessionMetaData>(sessions.size);
		let i = 0;
		for (const sessionId of sessions) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion, no-plusplus
			sessionsMetaData[i++] = this.cache.get(sessionId)!;
		}
		return sessionsMetaData;
	}

	public async update(sessionId: SessionId, metaData: Partial<SessionMetaData>): Promise<void> {
		const session = this.cache.get(sessionId);
		if (session == null) {
			throw new Error(`Session ${sessionId} not found.`);
		}
		session.accessedAt = metaData.accessedAt!;
	}

	public async delete(sessionId: SessionId): Promise<boolean> {
		this.invocations.set('delete', this.invocations.get('delete')! + 1);
		return this.cache.del(sessionId);
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

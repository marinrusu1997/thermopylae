import safeUid from 'uid-safe';
import { UnixTimestamp } from '@thermopylae/core.declarations';

interface CookieStorage<CookieData extends Record<string, any>> {
	create(sessionId: string, data: CookieData, expiresAt: UnixTimestamp): Promise<void>;
	read(sessionId: string): Promise<CookieData>;
	update(sessionId: string, data: CookieData): Promise<void>;
	delete(sessionId: string): Promise<boolean>;
}

// @fixme idle, absolute, renewal timeouts

// @fixme https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#binding-the-session-id-to-other-user-properties
//	we will need some sort of context with IP, User-Agent in the session data

// @fixme brute force detection

// @fixme https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#logging-sessions-life-cycle-monitoring-creation-usage-and-destruction-of-session-ids
//	log stuff

// @fixme lib.authentication-engine should not issue tokens for sessions, because Authentication != Session

// @fixme get active user sessions

class CookieSessionManager<CookieData extends Record<string, any>> {
	private readonly storage: CookieStorage<CookieData>;

	public constructor(storage: CookieStorage<CookieData>) {
		this.storage = storage;
	}

	public async create(data: CookieData, expiresAt: UnixTimestamp): Promise<string> {
		const sessionId = await safeUid(24);
		await this.storage.create(sessionId, data, expiresAt);
		return sessionId;
	}

	public read(sessionId: string): Promise<CookieData | undefined> {
		return this.storage.read(sessionId);
	}

	public update(sessionId: string, data: CookieData): Promise<void> {}

	public delete(sessionId: string): Promise<boolean> {}
}

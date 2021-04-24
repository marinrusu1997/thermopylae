import { randomBytes } from 'crypto';
import { UnixTimestamp } from '@thermopylae/core.declarations';

interface CookieStorage<CookieData extends Record<string, any>> {
	create(sessionId: string, data: CookieData, expiresAt: UnixTimestamp): Promise<void>;
	read(sessionId: string): Promise<CookieData>;
	update(sessionId: string, data: CookieData): Promise<void>;
	delete(sessionId: string): Promise<boolean>;
}

class SessionManager<CookieData extends Record<string, any>> {
	private readonly storage: CookieStorage<CookieData>;

	public constructor(storage: CookieStorage<CookieData>) {
		this.storage = storage;
	}

	public async create(data: CookieData, expiresAt: UnixTimestamp): Promise<string> {
		const sessionId = await SessionManager.generateSessionId();
		await this.storage.create(sessionId, data, expiresAt);
		return sessionId;
	}

	public read(sessionId: string): Promise<CookieData | undefined> {
		return this.storage.read(sessionId);
	}

	public update(sessionId: string, data: CookieData): Promise<void> {}

	public delete(sessionId: string): Promise<boolean> {}

	private static generateSessionId(): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			// @fixme test is 32
			randomBytes(32, (err, buffer) => (err ? reject(err) : resolve(buffer.toString('hex'))));
		});
	}
}

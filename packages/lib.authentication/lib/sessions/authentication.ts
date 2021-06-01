import type { Seconds } from '@thermopylae/core.declarations';
import type { AuthenticationSessionRepository } from '../types/repositories';
import type { AuthenticationSession } from '../types/sessions';

class AuthenticationSessionRepositoryHolder {
	private readonly repository: AuthenticationSessionRepository;

	private readonly username: string;

	private readonly deviceId: string;

	private session: AuthenticationSession | null;

	public constructor(repository: AuthenticationSessionRepository, username: string, deviceId: string) {
		this.repository = repository;
		this.username = username;
		this.deviceId = deviceId;
		this.session = null;
	}

	public async get(): Promise<AuthenticationSession> {
		if (this.session != null) {
			return this.session;
		}

		this.session = await this.repository.read(this.username, this.deviceId);
		if (this.session == null) {
			this.session = {};
		}

		return this.session;
	}

	public async delete(): Promise<void> {
		await this.repository.delete(this.username, this.deviceId);
	}

	public async flush(sessionTtl: Seconds): Promise<void> {
		if (this.session != null) {
			await this.repository.upsert(this.username, this.deviceId, this.session, sessionTtl);
		}
	}
}

export { AuthenticationSessionRepositoryHolder };

import type { Seconds } from '@thermopylae/core.declarations';
import type { AuthenticationSessionRepository } from '../types/repositories';
import type { AuthenticationSession } from '../types/sessions';

class AuthenticationSessionRepositoryHolder {
	private readonly repository: AuthenticationSessionRepository;

	private session: AuthenticationSession | null;

	public constructor(repository: AuthenticationSessionRepository) {
		this.repository = repository;
		this.session = null;
	}

	public async get(username: string, deviceId: string): Promise<AuthenticationSession> {
		if (this.session != null) {
			return this.session;
		}

		this.session = await this.repository.read(username, deviceId);
		if (this.session == null) {
			this.session = {};
		}

		return this.session;
	}

	public async delete(username: string, deviceId: string): Promise<void> {
		await this.repository.delete(username, deviceId);
	}

	public async flush(username: string, deviceId: string, sessionTtl: Seconds): Promise<void> {
		if (this.session != null) {
			await this.repository.upsert(username, deviceId, this.session, sessionTtl);
		}
	}
}

export { AuthenticationSessionRepositoryHolder };

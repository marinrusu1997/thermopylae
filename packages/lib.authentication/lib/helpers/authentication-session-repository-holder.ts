import type { Seconds } from '@thermopylae/core.declarations';
import type { AuthenticationSessionRepository } from '../types/repositories';
import type { AuthenticationSession } from '../types/sessions';
import type { AuthenticationContext } from '../types/contexts';

class AuthenticationSessionRepositoryHolder {
	private readonly repository: AuthenticationSessionRepository;

	private readonly authenticationContext: AuthenticationContext;

	private session: AuthenticationSession | null;

	private sessionWasReadFromRepository: boolean;

	public constructor(repository: AuthenticationSessionRepository, authenticationContext: AuthenticationContext) {
		this.repository = repository;
		this.authenticationContext = authenticationContext;
		this.session = null;
		this.sessionWasReadFromRepository = false;
	}

	public async get(): Promise<AuthenticationSession> {
		if (this.session != null) {
			return this.session;
		}

		this.session = await this.repository.read(this.authenticationContext.username, this.authenticationContext.deviceId);
		if (this.session == null) {
			this.session = {};
		} else {
			this.sessionWasReadFromRepository = true;
		}

		return this.session;
	}

	public async delete(): Promise<void> {
		if (this.sessionWasReadFromRepository) {
			await this.repository.delete(this.authenticationContext.username, this.authenticationContext.deviceId);

			this.session = null;
			this.sessionWasReadFromRepository = false;
		}
	}

	public async flush(sessionTtl: Seconds): Promise<void> {
		if (this.session != null) {
			await this.repository.upsert(this.authenticationContext.username, this.authenticationContext.deviceId, this.session, sessionTtl);

			this.session = null;
			this.sessionWasReadFromRepository = false;
		}
	}
}

export { AuthenticationSessionRepositoryHolder };

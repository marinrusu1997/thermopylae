import type { PartialSome, Seconds, Threshold } from '@thermopylae/core.declarations';
import { getCurrentTimestamp } from '../utils';
import type { AccountModel, FailedAuthenticationModel } from '../types/models';
import type { FailedAuthAttemptSessionRepository, FailedAuthenticationAttemptsRepository } from '../types/repositories';
import type { AccountManager } from './account';
import type { BaseContext } from '../types/contexts';
import type { FailedAuthenticationAttemptSession } from '../types/sessions';

class FailedAuthenticationsManager<Account extends AccountModel> {
	private readonly failedAuthAttemptsAccountDisableThreshold: Threshold;

	private readonly failedAuthAttemptSessionTtl: Seconds;

	private readonly accountDisableTimeout: Seconds;

	private readonly accountManager: AccountManager<Account>;

	private readonly failedAuthAttemptSessionRepository: FailedAuthAttemptSessionRepository;

	private readonly failedAuthenticationAttemptsRepository: FailedAuthenticationAttemptsRepository;

	public constructor(
		failedAuthAttemptsAccountDisableThreshold: Threshold,
		failedAuthAttemptSessionTtl: Seconds,
		accountDisableTimeout: Seconds,
		accountManager: AccountManager<Account>,
		failedAuthAttemptSessionRepository: FailedAuthAttemptSessionRepository,
		failedAuthenticationAttemptsRepository: FailedAuthenticationAttemptsRepository
	) {
		this.failedAuthAttemptsAccountDisableThreshold = failedAuthAttemptsAccountDisableThreshold;
		this.failedAuthAttemptSessionTtl = failedAuthAttemptSessionTtl;
		this.accountDisableTimeout = accountDisableTimeout;
		this.accountManager = accountManager;
		this.failedAuthAttemptSessionRepository = failedAuthAttemptSessionRepository;
		this.failedAuthenticationAttemptsRepository = failedAuthenticationAttemptsRepository;
	}

	/**
	 * @returns     Session on successful increment or `null` if session was deleted and account disabled.
	 */
	public async incrementSession(account: Account, context: BaseContext): Promise<FailedAuthenticationAttemptSession | null> {
		const currentTimestamp = getCurrentTimestamp();

		let failedAuthAttemptSession = await this.failedAuthAttemptSessionRepository.read(account.username);
		if (failedAuthAttemptSession == null) {
			failedAuthAttemptSession = {
				ip: context.ip,
				device: context.device,
				location: context.location,
				detectedAt: currentTimestamp,
				counter: 1
			};
			await this.failedAuthAttemptSessionRepository.insert(account.username, failedAuthAttemptSession, this.failedAuthAttemptSessionTtl);
		} else {
			failedAuthAttemptSession.ip = context.ip;
			failedAuthAttemptSession.device = context.device;
			failedAuthAttemptSession.location = context.location;
			failedAuthAttemptSession.detectedAt = currentTimestamp;
			failedAuthAttemptSession.counter += 1;

			if (failedAuthAttemptSession.counter <= this.failedAuthAttemptsAccountDisableThreshold) {
				// update only in case it will not be deleted later by reached threshold
				await this.failedAuthAttemptSessionRepository.replace(account.username, failedAuthAttemptSession);
			}
		}

		if (failedAuthAttemptSession.counter >= this.failedAuthAttemptsAccountDisableThreshold) {
			(failedAuthAttemptSession as unknown as FailedAuthenticationModel).accountId = account.id;
			delete (failedAuthAttemptSession as PartialSome<FailedAuthenticationAttemptSession, 'counter'>).counter;

			await Promise.all([
				await this.accountManager.disable(
					account,
					currentTimestamp + this.accountDisableTimeout,
					`Threshold of failed authentication attempts was reached (${failedAuthAttemptSession.counter} attempts).`
				),
				this.failedAuthenticationAttemptsRepository.insert(failedAuthAttemptSession as unknown as FailedAuthenticationModel),
				this.failedAuthAttemptSessionRepository.delete(account.username)
			]);

			return null;
		}

		return failedAuthAttemptSession;
	}

	public async deleteSession(account: Account): Promise<void> {
		await this.failedAuthAttemptSessionRepository.delete(account.username);
	}
}

export { FailedAuthenticationsManager };

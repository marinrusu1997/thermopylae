import { AuthStep, AuthStepOutput } from './auth-step';
import { AuthNetworkInput } from '../types';
import { Account } from '../models';
import { AuthSession } from '../models/sessions';
import { AccountEntity, FailedAuthAttemptsEntity, FailedAuthAttemptSessionEntity } from '../models/entities';
import { AccountLocker } from '../managers/account-locker';
import { logger } from '../logger';
import { createException, ErrorCodes } from '../error';
import { AUTH_STEP } from '../enums';

class ErrorStep implements AuthStep {
	private readonly adminEmail: string;
	private readonly failedAuthAttemptsThreshold: number;
	private readonly recaptchaThreshold: number;
	private readonly failedAuthAttemptSessionTtl: number;
	private readonly accountEntity: AccountEntity;
	private readonly failedAuthAttemptSessionEntity: FailedAuthAttemptSessionEntity;
	private readonly failedAuthAttemptsEntity: FailedAuthAttemptsEntity;
	private readonly accountLocker: AccountLocker;

	constructor(
		adminEmail: string,
		failedAuthAttemptsThreshold: number,
		recaptchaThreshold: number,
		failedAuthAttemptSessionTtl: number,
		accountEntity: AccountEntity,
		failedAuthAttemptSessionEntity: FailedAuthAttemptSessionEntity,
		failedAuthAttemptsEntity: FailedAuthAttemptsEntity,
		accountLocker: AccountLocker
	) {
		this.adminEmail = adminEmail;
		this.failedAuthAttemptsThreshold = failedAuthAttemptsThreshold;
		this.recaptchaThreshold = recaptchaThreshold;
		this.failedAuthAttemptSessionTtl = failedAuthAttemptSessionTtl;
		this.accountEntity = accountEntity;
		this.failedAuthAttemptSessionEntity = failedAuthAttemptSessionEntity;
		this.failedAuthAttemptsEntity = failedAuthAttemptsEntity;
		this.accountLocker = accountLocker;
	}

	async process(networkInput: AuthNetworkInput, account: Account, session: AuthSession): Promise<AuthStepOutput> {
		const now = new Date().getTime();
		let failedAuthAttemptSession = await this.failedAuthAttemptSessionEntity.read(networkInput.username);
		if (!failedAuthAttemptSession) {
			failedAuthAttemptSession = { timestamp: now, ip: [networkInput.ip], device: [networkInput.device], counter: 1 };
			await this.failedAuthAttemptSessionEntity.create(networkInput.username, failedAuthAttemptSession, this.failedAuthAttemptSessionTtl);
		} else {
			failedAuthAttemptSession.timestamp = now;
			failedAuthAttemptSession.ip.push(networkInput.ip);
			failedAuthAttemptSession.device.push(networkInput.device);
			failedAuthAttemptSession.counter += 1;

			if (failedAuthAttemptSession.counter <= this.failedAuthAttemptsThreshold) {
				// update only in case it will not be deleted by reached threshold
				await this.failedAuthAttemptSessionEntity.update(networkInput.username, failedAuthAttemptSession);
			}
		}

		if (failedAuthAttemptSession.counter >= this.failedAuthAttemptsThreshold) {
			const promises: Array<Promise<any>> = [];
			promises.push(
				this.accountLocker
					.prepareLocking(account, this.adminEmail, `Threshold of failed authentication attempts (${this.failedAuthAttemptsThreshold}) was reached`)
					.then(() => this.accountEntity.lock(account.id!))
			);
			promises.push(
				this.failedAuthAttemptsEntity
					.create({
						accountId: account.id!,
						timestamp: now,
						ips: failedAuthAttemptSession.ip.join(','),
						devices: failedAuthAttemptSession.device.join(',')
					})
					.catch(error => logger.warn(`Failed to persist failed auth attempts for account ${account.id}`, error))
			);
			promises.push(
				this.failedAuthAttemptSessionEntity
					.delete(account.username)
					.catch(error => logger.warn(`Failed to delete failed auth attempts session for account ${account.id}`, error))
			);
			await Promise.all(promises);

			throw createException(ErrorCodes.ACCOUNT_WAS_LOCKED, `Account was locked due to reached threshold of failed auth attempts (${failedAuthAttemptSession.counter}).`);
		}

		if (failedAuthAttemptSession.counter >= this.recaptchaThreshold) {
			session.recaptchaRequired = true;
		}

		return { nextStep: AUTH_STEP.SECRET };
	}
}

export { ErrorStep };

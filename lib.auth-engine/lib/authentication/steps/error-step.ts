import { AuthStep, AuthStepOutput } from '../auth-step';
import { AuthRequest } from '../../types/requests';
import { AccountModel } from '../../types/models';
import { OnGoingAuthenticationSession } from '../../types/sessions';
import { FailedAuthAttemptSessionEntity, FailedAuthenticationAttemptsEntity } from '../../types/entities';
import { AccountStatusManager, EnableAfterCause } from '../../managers/account-status-manager';
import { getLogger } from '../../logger';
import { createException, ErrorCodes } from '../../error';
import { AUTH_STEP } from '../../types/enums';

class ErrorStep implements AuthStep {
	private readonly failedAuthAttemptsThreshold: number;
	private readonly recaptchaThreshold: number;
	private readonly failedAuthAttemptSessionTtl: number;
	private readonly accountStatusManager: AccountStatusManager;
	private readonly failedAuthAttemptSessionEntity: FailedAuthAttemptSessionEntity;
	private readonly failedAuthAttemptsEntity: FailedAuthenticationAttemptsEntity;

	constructor(
		failedAuthAttemptsThreshold: number,
		recaptchaThreshold: number,
		failedAuthAttemptSessionTtl: number,
		accountStatusManager: AccountStatusManager,
		failedAuthAttemptSessionEntity: FailedAuthAttemptSessionEntity,
		failedAuthAttemptsEntity: FailedAuthenticationAttemptsEntity
	) {
		this.failedAuthAttemptsThreshold = failedAuthAttemptsThreshold;
		this.recaptchaThreshold = recaptchaThreshold;
		this.failedAuthAttemptSessionTtl = failedAuthAttemptSessionTtl;
		this.accountStatusManager = accountStatusManager;
		this.failedAuthAttemptSessionEntity = failedAuthAttemptSessionEntity;
		this.failedAuthAttemptsEntity = failedAuthAttemptsEntity;
	}

	async process(
		authRequest: AuthRequest,
		account: AccountModel,
		onGoingAuthenticationSession: OnGoingAuthenticationSession,
		prevStepName: AUTH_STEP
	): Promise<AuthStepOutput> {
		const now = new Date();
		let failedAuthAttemptSession = await this.failedAuthAttemptSessionEntity.read(authRequest.username);
		if (!failedAuthAttemptSession) {
			failedAuthAttemptSession = { detectedAt: now, ip: authRequest.ip, device: authRequest.device, counter: 1 };
			await this.failedAuthAttemptSessionEntity.create(authRequest.username, failedAuthAttemptSession, this.failedAuthAttemptSessionTtl);
		} else {
			failedAuthAttemptSession.detectedAt = now;
			failedAuthAttemptSession.ip = authRequest.ip;
			failedAuthAttemptSession.device = authRequest.device;
			failedAuthAttemptSession.counter += 1;

			if (failedAuthAttemptSession.counter <= this.failedAuthAttemptsThreshold) {
				// update only in case it will not be deleted later by reached threshold
				await this.failedAuthAttemptSessionEntity.update(authRequest.username, failedAuthAttemptSession);
			}
		}

		if (failedAuthAttemptSession.counter >= this.failedAuthAttemptsThreshold) {
			const promises: Array<Promise<any>> = [];

			// make sure account is disabled, this is the most important
			await this.accountStatusManager.disable(account, `Threshold of failed authentication attempts (${this.failedAuthAttemptsThreshold}) was reached.`);

			// account is disabled, safely schedule it's enabling in the near future
			await this.accountStatusManager.enableAfter(account.id!, EnableAfterCause.FAILED_AUTH_ATTEMPT);

			promises.push(
				this.failedAuthAttemptsEntity
					.create({
						accountId: account.id!,
						detectedAt: now,
						ip: failedAuthAttemptSession.ip,
						device: failedAuthAttemptSession.device
					})
					.catch(error => getLogger().error(`Failed to persist failed auth attempts for account ${account.id}. `, error))
			);
			promises.push(
				this.failedAuthAttemptSessionEntity
					.delete(account.username)
					.catch(error => getLogger().error(`Failed to delete failed auth attempts session for account ${account.id}. `, error))
			);
			await Promise.all(promises);

			return {
				done: {
					error: {
						hard: createException(
							ErrorCodes.ACCOUNT_DISABLED,
							`Account was disabled due to reached threshold of failed auth attempts (${failedAuthAttemptSession.counter}). `
						)
					}
				}
			};
		}

		const errorMessage = `Credentials are not valid. Remaining attempts (${this.failedAuthAttemptsThreshold - failedAuthAttemptSession.counter}). `;

		if (failedAuthAttemptSession.counter >= this.recaptchaThreshold) {
			onGoingAuthenticationSession.recaptchaRequired = true;
			// when intercepted, this will allow at the upper levels to send to client svg captcha, depends on chosen implementation
			return {
				done: {
					// ternary is needed in order to inform client that it's time to use captcha
					nextStep: prevStepName === AUTH_STEP.PASSWORD ? AUTH_STEP.RECAPTCHA : prevStepName,
					error: {
						soft: createException(ErrorCodes.RECAPTCHA_THRESHOLD_REACHED, errorMessage)
					}
				}
			};
		}

		return {
			done: {
				nextStep: prevStepName,
				error: {
					soft: createException(ErrorCodes.INCORRECT_CREDENTIALS, errorMessage)
				}
			}
		};
	}
}

export { ErrorStep };

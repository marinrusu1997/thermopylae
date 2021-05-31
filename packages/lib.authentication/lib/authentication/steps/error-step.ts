import { AuthStep, AuthStepOutput } from '../auth-step';
import { AuthenticationContext } from '../../types/requests';
import { AccountModel } from '../../types/models';
import { AuthenticationSession } from '../../types/sessions';
import { FailedAuthAttemptSessionRepository, FailedAuthenticationAttemptsRepository } from '../../types/repositories';
import { AccountStatusManager, EnableAfterCause } from '../../managers/account-status-manager';
import { createException, ErrorCodes } from '../../error';
import { AUTH_STEP } from '../../types/enums';
import { logger } from '../../logger';

class ErrorStep implements AuthStep {
	private readonly failedAuthAttemptsThreshold: number;

	private readonly recaptchaThreshold: number;

	private readonly failedAuthAttemptSessionTtl: number;

	private readonly accountStatusManager: AccountStatusManager;

	private readonly failedAuthAttemptSessionEntity: FailedAuthAttemptSessionRepository;

	private readonly failedAuthAttemptsEntity: FailedAuthenticationAttemptsRepository;

	constructor(
		failedAuthAttemptsThreshold: number,
		recaptchaThreshold: number,
		failedAuthAttemptSessionTtl: number,
		accountStatusManager: AccountStatusManager,
		failedAuthAttemptSessionEntity: FailedAuthAttemptSessionRepository,
		failedAuthAttemptsEntity: FailedAuthenticationAttemptsRepository
	) {
		this.failedAuthAttemptsThreshold = failedAuthAttemptsThreshold;
		this.recaptchaThreshold = recaptchaThreshold;
		this.failedAuthAttemptSessionTtl = failedAuthAttemptSessionTtl;
		this.accountStatusManager = accountStatusManager;
		this.failedAuthAttemptSessionEntity = failedAuthAttemptSessionEntity;
		this.failedAuthAttemptsEntity = failedAuthAttemptsEntity;
	}

	async process(
		authRequest: AuthenticationContext,
		account: AccountModel,
		onGoingAuthenticationSession: AuthenticationSession,
		prevStepName: AUTH_STEP
	): Promise<AuthStepOutput> {
		const now = new Date();
		let failedAuthAttemptSession = await this.failedAuthAttemptSessionEntity.read(authRequest.username);
		if (!failedAuthAttemptSession) {
			failedAuthAttemptSession = { detectedAt: now, ip: authRequest.ip, device: authRequest.device, counter: 1 };
			await this.failedAuthAttemptSessionEntity.insert(authRequest.username, failedAuthAttemptSession, this.failedAuthAttemptSessionTtl);
		} else {
			failedAuthAttemptSession.detectedAt = now;
			failedAuthAttemptSession.ip = authRequest.ip;
			failedAuthAttemptSession.device = authRequest.device;
			failedAuthAttemptSession.counter += 1;

			if (failedAuthAttemptSession.counter <= this.failedAuthAttemptsThreshold) {
				// update only in case it will not be deleted later by reached threshold
				await this.failedAuthAttemptSessionEntity.replace(authRequest.username, failedAuthAttemptSession);
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
					.insert({
						accountId: account.id!,
						detectedAt: now,
						ip: failedAuthAttemptSession.ip,
						device: failedAuthAttemptSession.device
					})
					.catch((error) => logger.error(`Failed to persist failed auth attempts for account ${account.id}. `, error))
			);
			promises.push(
				this.failedAuthAttemptSessionEntity
					.delete(account.username)
					.catch((error) => logger.error(`Failed to delete failed auth attempts session for account ${account.id}. `, error))
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
				// totp are generated only after successful password validation,
				// therefore this cycle must be repeated, as we don't know whether provided totp is invalid or the stored one expired
				nextStep: prevStepName === AUTH_STEP.TOTP ? AUTH_STEP.PASSWORD : prevStepName,
				error: {
					soft: createException(ErrorCodes.INCORRECT_CREDENTIALS, errorMessage)
				}
			}
		};
	}
}

export { ErrorStep };

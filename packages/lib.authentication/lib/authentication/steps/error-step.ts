import type { Seconds, Threshold } from '@thermopylae/core.declarations';
import { createException, ErrorCodes } from '../../error';
import { getCurrentTimestamp } from '../../utils';
import { AuthenticationStepName } from '../../types/enums';
import type { AuthenticationStep, AuthenticationStepOutput } from '../step';
import type { AccountModel } from '../../types/models';
import type { FailedAuthAttemptSessionRepository, FailedAuthenticationAttemptsRepository } from '../../types/repositories';
import type { AccountManager } from '../../managers/account';
import type { AuthenticationSessionRepositoryHolder } from '../../sessions/authentication';
import type { AuthenticationContext } from '../../types/contexts';

class ErrorStep<Account extends AccountModel> implements AuthenticationStep<Account> {
	private readonly failedAuthAttemptsThreshold: Threshold;

	private readonly recaptchaThreshold: Threshold;

	private readonly accountDisableTimeout: Seconds;

	private readonly failedAuthAttemptSessionTtl: Seconds;

	private readonly accountStatusManager: AccountManager<Account>;

	private readonly failedAuthAttemptSessionRepository: FailedAuthAttemptSessionRepository;

	private readonly failedAuthenticationAttemptsRepository: FailedAuthenticationAttemptsRepository;

	public constructor(
		failedAuthAttemptsThreshold: Threshold,
		recaptchaThreshold: Threshold,
		accountDisableTimeout: Seconds,
		failedAuthAttemptSessionTtl: Seconds,
		accountStatusManager: AccountManager<Account>,
		failedAuthAttemptSessionRepository: FailedAuthAttemptSessionRepository,
		failedAuthenticationAttemptsRepository: FailedAuthenticationAttemptsRepository
	) {
		this.failedAuthAttemptsThreshold = failedAuthAttemptsThreshold;
		this.recaptchaThreshold = recaptchaThreshold;
		this.accountDisableTimeout = accountDisableTimeout;
		this.failedAuthAttemptSessionTtl = failedAuthAttemptSessionTtl;
		this.accountStatusManager = accountStatusManager;
		this.failedAuthAttemptSessionRepository = failedAuthAttemptSessionRepository;
		this.failedAuthenticationAttemptsRepository = failedAuthenticationAttemptsRepository;
	}

	public async process(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder,
		previousAuthenticationStepName: AuthenticationStepName
	): Promise<AuthenticationStepOutput> {
		const currentTimestamp = getCurrentTimestamp();

		let failedAuthAttemptSession = await this.failedAuthAttemptSessionRepository.read(authenticationContext.username);
		if (failedAuthAttemptSession == null) {
			failedAuthAttemptSession = { detectedAt: currentTimestamp, ip: authenticationContext.ip, device: authenticationContext.device, counter: 1 };
			await this.failedAuthAttemptSessionRepository.insert(authenticationContext.username, failedAuthAttemptSession, this.failedAuthAttemptSessionTtl);
		} else {
			failedAuthAttemptSession.detectedAt = currentTimestamp;
			failedAuthAttemptSession.ip = authenticationContext.ip;
			failedAuthAttemptSession.device = authenticationContext.device;
			failedAuthAttemptSession.counter += 1;

			if (failedAuthAttemptSession.counter <= this.failedAuthAttemptsThreshold) {
				// update only in case it will not be deleted later by reached threshold
				await this.failedAuthAttemptSessionRepository.replace(authenticationContext.username, failedAuthAttemptSession);
			}
		}

		if (failedAuthAttemptSession.counter >= this.failedAuthAttemptsThreshold) {
			await Promise.all([
				await this.accountStatusManager.disable(
					account,
					currentTimestamp + this.accountDisableTimeout,
					`Threshold of failed authentication attempts was reached (${failedAuthAttemptSession.counter} attempts).`
				),
				this.failedAuthenticationAttemptsRepository.insert({
					id: undefined!, // will be set by repo
					accountId: account.id,
					detectedAt: currentTimestamp,
					ip: failedAuthAttemptSession.ip,
					device: failedAuthAttemptSession.device
				}),
				this.failedAuthAttemptSessionRepository.delete(account.username)
			]);

			return {
				done: {
					error: {
						hard: createException(
							ErrorCodes.ACCOUNT_DISABLED,
							`Account was disabled due to reached threshold of failed auth attempts (${failedAuthAttemptSession.counter}).`
						)
					}
				}
			};
		}

		const errorMessage = `Credentials are not valid. Remaining attempts (${this.failedAuthAttemptsThreshold - failedAuthAttemptSession.counter}).`;

		if (failedAuthAttemptSession.counter >= this.recaptchaThreshold) {
			const authenticationSession = await authenticationSessionRepositoryHolder.get();
			authenticationSession.recaptchaRequired = true;
			// when intercepted, this will allow at the upper levels to send to client svg captcha, depends on chosen implementation
			return {
				done: {
					// ternary is needed in order to inform client that it's time to use captcha
					nextStep:
						previousAuthenticationStepName === AuthenticationStepName.PASSWORD ? AuthenticationStepName.RECAPTCHA : previousAuthenticationStepName,
					error: {
						soft: createException(ErrorCodes.RECAPTCHA_THRESHOLD_REACHED, errorMessage)
					}
				}
			};
		}

		return {
			done: {
				// two factor tokens are generated only after successful password validation,
				// therefore this cycle must be repeated, as we don't know whether provided token is invalid or the stored one expired
				nextStep:
					previousAuthenticationStepName === AuthenticationStepName.TWO_FACTOR_AUTH_CHECK
						? AuthenticationStepName.PASSWORD
						: previousAuthenticationStepName,
				error: {
					soft: createException(ErrorCodes.INCORRECT_CREDENTIALS, errorMessage)
				}
			}
		};
	}
}

export { ErrorStep };

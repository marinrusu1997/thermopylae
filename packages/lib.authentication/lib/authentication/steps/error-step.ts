import type { Threshold } from '@thermopylae/core.declarations';
import { createException, ErrorCodes } from '../../error';
import { AuthenticationStepName } from '../../types/enums';
import type { AuthenticationStep, AuthenticationStepOutput } from '../step';
import type { AccountModel } from '../../types/models';
import type { AuthenticationSessionRepositoryHolder } from '../../helpers/authentication-session-repository-holder';
import type { AuthenticationContext } from '../../types/contexts';
import type { FailedAuthenticationsManager } from '../../managers/failed-authentications';

class ErrorStep<Account extends AccountModel> implements AuthenticationStep<Account> {
	private readonly failedAuthAttemptsThreshold: Threshold;

	private readonly recaptchaThreshold: Threshold;

	private readonly failedAuthenticationsManager: FailedAuthenticationsManager<Account>;

	public constructor(
		failedAuthAttemptsThreshold: Threshold,
		recaptchaThreshold: Threshold,
		failedAuthenticationsManager: FailedAuthenticationsManager<Account>
	) {
		this.failedAuthAttemptsThreshold = failedAuthAttemptsThreshold;
		this.recaptchaThreshold = recaptchaThreshold;
		this.failedAuthenticationsManager = failedAuthenticationsManager;
	}

	public async process(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder,
		previousAuthenticationStepName: AuthenticationStepName
	): Promise<AuthenticationStepOutput> {
		const failedAuthAttemptSession = await this.failedAuthenticationsManager.incrementSession(account, authenticationContext);

		if (failedAuthAttemptSession == null) {
			return {
				done: {
					error: {
						hard: createException(ErrorCodes.ACCOUNT_DISABLED, 'Account was disabled due to reached threshold of failed auth attempts.')
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

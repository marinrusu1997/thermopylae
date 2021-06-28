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
	): Promise<AuthenticationStepOutput<Account>> {
		const failedAuthAttemptSession = await this.failedAuthenticationsManager.incrementSession(account, authenticationContext);

		if (failedAuthAttemptSession == null) {
			await authenticationSessionRepositoryHolder.delete(true); // this is a dead end for auth, so we need to remove this session

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

			return {
				done: {
					// ternary is needed in order to inform client that it's time to use captcha
					nextStep:
						previousAuthenticationStepName === AuthenticationStepName.PASSWORD ? AuthenticationStepName.RECAPTCHA : previousAuthenticationStepName,
					error: {
						soft: createException(
							previousAuthenticationStepName === AuthenticationStepName.RECAPTCHA
								? ErrorCodes.INCORRECT_RECAPTCHA
								: ErrorCodes.INCORRECT_CREDENTIALS,
							errorMessage
						)
					}
				}
			};
		}

		let nextStep: AuthenticationStepName;
		if (previousAuthenticationStepName === AuthenticationStepName.TWO_FACTOR_AUTH_CHECK) {
			const authenticationSession = await authenticationSessionRepositoryHolder.get();

			if (authenticationSession['2fa-token'] != null) {
				nextStep = AuthenticationStepName.TWO_FACTOR_AUTH_CHECK;
			} else {
				nextStep = AuthenticationStepName.PASSWORD;
			}
		} else {
			nextStep = previousAuthenticationStepName;
		}

		return {
			done: {
				nextStep,
				error: {
					soft: createException(ErrorCodes.INCORRECT_CREDENTIALS, errorMessage)
				}
			}
		};
	}
}

export { ErrorStep };

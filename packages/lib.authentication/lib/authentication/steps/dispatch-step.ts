import { ErrorCodes, createException } from '../../error.js';
import type { AuthenticationContext } from '../../types/contexts.js';
import { AuthenticationStepName } from '../../types/enums.js';
import type { AccountModel } from '../../types/models.js';
import type { AuthenticationStep, AuthenticationStepOutput } from '../step.js';

/** @private */
class DispatchStep<Account extends AccountModel> implements AuthenticationStep<Account> {
	public async process(_account: Account, authenticationContext: AuthenticationContext): Promise<AuthenticationStepOutput<Account>> {
		// generate challenge has the highest priority, needs to be used before checking response
		if (authenticationContext.generateChallenge) {
			return { nextStep: AuthenticationStepName.GENERATE_CHALLENGE };
		}

		if (authenticationContext.responseForChallenge) {
			return { nextStep: AuthenticationStepName.CHALLENGE_RESPONSE };
		}

		if (authenticationContext.twoFactorAuthenticationToken) {
			// safe, because totp is verified with server secret or authentication session
			return { nextStep: AuthenticationStepName.TWO_FACTOR_AUTH_CHECK };
		}

		if (authenticationContext.password) {
			return { nextStep: AuthenticationStepName.PASSWORD };
		}

		// configuration error, user input not validated properly
		throw createException(
			ErrorCodes.AUTH_STEP_MISCONFIGURATION,
			`Can't resolve next step to move from ${AuthenticationStepName.DISPATCH}. Authentication context needs to be validated to contain at least one authentication related property.`
		);
	}
}

export { DispatchStep };

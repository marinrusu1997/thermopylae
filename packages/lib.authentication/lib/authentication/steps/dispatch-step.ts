import { ErrorCodes } from '@thermopylae/core.declarations';
import { AuthStep, AuthStepOutput } from '../auth-step';
import { createException } from '../../error';
import { AUTH_STEP } from '../../types/enums';
import { AuthRequest } from '../../types/requests';

class DispatchStep implements AuthStep {
	async process(authRequest: AuthRequest): Promise<AuthStepOutput> {
		// generate challenge has the highest priority, needs to be used before checking response
		if (authRequest.generateChallenge) {
			return { nextStep: AUTH_STEP.GENERATE_CHALLENGE };
		}
		if (authRequest.responseForChallenge) {
			return { nextStep: AUTH_STEP.CHALLENGE_RESPONSE };
		}
		if (authRequest.totp) {
			// safe, because totp is verified with server secret and is very short living (<= 30s)
			return { nextStep: AUTH_STEP.TOTP };
		}
		if (authRequest.password) {
			return { nextStep: AUTH_STEP.PASSWORD };
		}
		// configuration error, user input not validated properly, allowed to throw
		throw createException(ErrorCodes.UNKNOWN, `Can't resolve next step from ${AUTH_STEP.DISPATCH}. `);
	}
}

export { DispatchStep };

import { AuthStep, AuthStepOutput } from '../auth-step';
import { createException, ErrorCodes } from '../../error';
import { AUTH_STEP } from '../../types/enums';
import { AuthRequest } from '../../types/requests';

class DispatchStep implements AuthStep {
	async process(networkInput: AuthRequest): Promise<AuthStepOutput> {
		// generate challenge has the highest priority, needs to be used before checking response
		if (networkInput.generateChallenge) {
			return { nextStep: AUTH_STEP.GENERATE_CHALLENGE };
		}
		if (networkInput.responseForChallenge) {
			return { nextStep: AUTH_STEP.CHALLENGE_RESPONSE };
		}
		if (networkInput.totp) {
			// safe, because totp is verified with server secret and is very short living (<= 30s)
			return { nextStep: AUTH_STEP.TOTP };
		}
		if (networkInput.password) {
			return { nextStep: AUTH_STEP.PASSWORD };
		}
		throw createException(ErrorCodes.INVALID_ARGUMENT, "Can't resolve next step", networkInput);
	}
}

export { DispatchStep };
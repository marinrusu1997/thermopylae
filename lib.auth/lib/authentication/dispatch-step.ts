import { AuthStep, AuthStepOutput } from './auth-step';
import { createException, ErrorCodes } from '../error';
import { AUTH_STEP } from '../enums';
import { AuthNetworkInput } from '../types';

class DispatchStep implements AuthStep {
	async process(networkInput: AuthNetworkInput): Promise<AuthStepOutput> {
		if (networkInput.totp) {
			// safe, because totp is verified with server secret and is very short living (<= 30s)
			return { nextStep: AUTH_STEP.TOTP };
		}
		if (networkInput.password) {
			return { nextStep: AUTH_STEP.SECRET };
		}
		throw createException(ErrorCodes.INVALID_ARGUMENT, "Can't resolve next step", networkInput);
	}
}

export { DispatchStep };

import { ErrorCodes } from '@thermopylae/core.declarations';
import { AuthStatus, AuthStep } from './auth-step';
import { createException } from '../error';
import { AuthenticationContext } from '../types/requests';
import { AccountModel } from '../types/models';
import { AUTH_STEP } from '../types/enums';
import { AuthenticationSession } from '../types/sessions';

class AuthOrchestrator {
	private readonly startStepName: AUTH_STEP;

	private readonly steps: Map<AUTH_STEP, AuthStep> = new Map<AUTH_STEP, AuthStep>();

	public constructor(startStepName: AUTH_STEP = AUTH_STEP.DISPATCH) {
		this.startStepName = startStepName;
	}

	public register(name: AUTH_STEP, step: AuthStep): void {
		this.steps.set(name, step);
	}

	public async authenticate(authRequest: AuthenticationContext, account: AccountModel, session: AuthenticationSession): Promise<AuthStatus> {
		let currentStepName = this.startStepName;
		let prevStepName = AUTH_STEP.UNKNOWN;
		let currentStep = this.steps.get(currentStepName);

		// eslint-disable-next-line no-constant-condition
		while (true) {
			const output = await currentStep!.process(authRequest, account, session, prevStepName);
			prevStepName = currentStepName;
			currentStepName = output.nextStep!;
			if (currentStepName && !output.done) {
				currentStep = this.steps.get(currentStepName);
			} else if (output.done) {
				return output.done;
			} else {
				// configuration error, allowed to throw
				throw createException(ErrorCodes.INVALID, 'Expected done or next step');
			}
		}
	}
}

export { AuthOrchestrator };

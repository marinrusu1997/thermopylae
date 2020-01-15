import { AuthStatus, AuthStep } from './auth-step';
import { createException, ErrorCodes } from '../error';
import { AuthRequest } from '../types/requests';
import { AccountModel } from '../types/models';
import { AUTH_STEP } from '../types/enums';
import { AuthSession } from '../types/sessions';

class AuthOrchestrator {
	private readonly startStepName: AUTH_STEP;
	private readonly steps: Map<AUTH_STEP, AuthStep> = new Map<AUTH_STEP, AuthStep>();

	constructor(startStepName: AUTH_STEP = AUTH_STEP.DISPATCH) {
		this.startStepName = startStepName;
	}

	public register(name: AUTH_STEP, step: AuthStep): void {
		this.steps.set(name, step);
	}

	public async authenticate(data: AuthRequest, account: AccountModel, session: AuthSession): Promise<AuthStatus> {
		let currentStepName = this.startStepName;
		let prevStepName = AUTH_STEP.UNKNOWN;
		let currentStep = this.steps.get(currentStepName);
		while (true) {
			const output = await currentStep!.process(data, account, session, prevStepName);
			prevStepName = currentStepName;
			currentStepName = output.nextStep!;
			if (currentStepName && !output.done) {
				currentStep = this.steps.get(currentStepName);
			} else if (output.done) {
				return output.done;
			} else {
				/* istanbul ignore next */
				throw createException(ErrorCodes.INVALID_OUTPUT, 'Expected done or next step');
			}
		}
	}
}

export { AuthOrchestrator };

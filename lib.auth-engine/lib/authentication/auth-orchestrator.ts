import { AuthStatus, AuthStep } from './auth-step';
import { createException, ErrorCodes } from '../error';
import { AuthNetworkInput } from '../types';
import { Account } from '../models';
import { AUTH_STEP } from '../enums';
import { AuthSession } from '../models/sessions';

class AuthOrchestrator {
	private readonly startStep: AUTH_STEP;
	private readonly steps: Map<AUTH_STEP, AuthStep> = new Map<AUTH_STEP, AuthStep>();

	constructor(startStep: AUTH_STEP = AUTH_STEP.DISPATCH) {
		this.startStep = startStep;
	}

	public register(name: AUTH_STEP, step: AuthStep): void {
		this.steps.set(name, step);
	}

	public async authenticate(data: AuthNetworkInput, account: Account, session: AuthSession): Promise<AuthStatus> {
		let currentStep = this.steps.get(this.startStep);
		while (true) {
			const output = await currentStep!.process(data, account, session);
			if (output.nextStep && !output.done) {
				currentStep = this.steps.get(output.nextStep);
			} else if (output.done) {
				return output.done;
			} else {
				throw createException(ErrorCodes.INVALID_OUTPUT, 'Expected done or next step');
			}
		}
	}
}

export { AuthOrchestrator };

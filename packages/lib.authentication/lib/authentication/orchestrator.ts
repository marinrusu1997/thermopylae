import { ErrorCodes, createException } from '../error.js';
import type { AuthenticationSessionRepositoryHolder } from '../helpers/authentication-session-repository-holder.js';
import type { AuthenticationContext } from '../types/contexts.js';
import { AuthenticationStepName } from '../types/enums.js';
import type { AccountModel } from '../types/models.js';
import type { AuthenticationStatus, AuthenticationStep, AuthenticationStepOutput } from './step.js';

/** @private */
class AuthenticationOrchestrator<Account extends AccountModel> {
	private readonly startStepName: AuthenticationStepName;

	private readonly steps: Map<AuthenticationStepName, AuthenticationStep<Account>>;

	public constructor(startStepName: AuthenticationStepName) {
		this.startStepName = startStepName;
		this.steps = new Map<AuthenticationStepName, AuthenticationStep<Account>>();
	}

	public register(name: AuthenticationStepName, step: AuthenticationStep<Account>): void {
		this.steps.set(name, step);
	}

	public async authenticate(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<AuthenticationStatus<Account>> {
		let currentStepName: AuthenticationStepName | undefined = this.startStepName;
		let currentStep: AuthenticationStep<Account> = this.steps.get(currentStepName)!;
		let prevStepName = AuthenticationStepName.UNKNOWN;

		while (true) {
			const output: AuthenticationStepOutput<Account> = await currentStep.process(
				account,
				authenticationContext,
				authenticationSessionRepositoryHolder,
				prevStepName
			);

			prevStepName = currentStepName;
			currentStepName = output.nextStep;

			if (currentStepName != null && !output.done) {
				currentStep = this.steps.get(currentStepName)!;
			} else if (output.done) {
				return output.done;
			} else {
				// configuration error
				throw createException(ErrorCodes.INVALID_AUTHENTICATION_STEP_OUTPUT, 'Expected done or next step');
			}
		}
	}
}

export { AuthenticationOrchestrator };

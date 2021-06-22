import { ErrorCodes } from '@thermopylae/core.declarations';
import { createException } from '../error';
import { AuthenticationStepName } from '../types/enums';
import type { AuthenticationStatus, AuthenticationStep, AuthenticationStepOutput } from './step';
import type { AccountModel } from '../types/models';
import type { AuthenticationSessionRepositoryHolder } from '../helpers/authentication-session-repository-holder';
import type { AuthenticationContext } from '../types/contexts';

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

		// eslint-disable-next-line no-constant-condition
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
				throw createException(ErrorCodes.MISCONFIGURATION, 'Expected done or next step');
			}
		}
	}
}

export { AuthenticationOrchestrator };

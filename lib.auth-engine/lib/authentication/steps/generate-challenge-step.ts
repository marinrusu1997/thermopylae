import { token } from '@marin/lib.utils';
import { AuthStep, AuthStepOutput } from '../auth-step';
import { AuthRequest } from '../../types/requests';
import { AccountModel } from '../../types/models';
import { AuthSession } from '../../types/sessions';
import { AUTH_STEP } from '../../types/enums';

class GenerateChallengeStep implements AuthStep {
	private readonly tokenSize: number;

	constructor(tokenSize: number) {
		this.tokenSize = tokenSize;
	}

	async process(_networkInput: AuthRequest, _account: AccountModel, session: AuthSession): Promise<AuthStepOutput> {
		// not checking if a nonce was generated already, it's maybe failed because of network error and needs to be regenerated
		const nonce = (await token.generate(this.tokenSize)).plain;
		session.challengeResponseNonce = nonce; // store for later comparison in challenge response step
		return { done: { token: nonce, nextStep: AUTH_STEP.CHALLENGE_RESPONSE } };
	}
}

export { GenerateChallengeStep };

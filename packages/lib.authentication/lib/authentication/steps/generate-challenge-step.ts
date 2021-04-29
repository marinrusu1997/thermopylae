import safeUid from 'uid-safe';
import { AuthStep, AuthStepOutput } from '../auth-step';
import { AuthRequest } from '../../types/requests';
import { AccountModel } from '../../types/models';
import { OnGoingAuthenticationSession } from '../../types/sessions';
import { AUTH_STEP } from '../../types/enums';

class GenerateChallengeStep implements AuthStep {
	private readonly nonceSize: number;

	constructor(nonceSize: number) {
		this.nonceSize = nonceSize;
	}

	async process(_authRequest: AuthRequest, _account: AccountModel, session: OnGoingAuthenticationSession): Promise<AuthStepOutput> {
		// not checking if a nonce was generated already, it's maybe failed because of network error and needs to be regenerated
		const nonce = await safeUid(this.nonceSize);
		session.challengeResponseNonce = nonce; // store for later comparison in challenge response step
		return { done: { token: nonce, nextStep: AUTH_STEP.CHALLENGE_RESPONSE } };
	}
}

export { GenerateChallengeStep };

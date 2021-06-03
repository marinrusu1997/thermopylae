import safeUid from 'uid-safe';
import { AuthenticationStepName } from '../../types/enums';
import type { AuthenticationStep, AuthenticationStepOutput } from '../step';
import type { AccountModel } from '../../types/models';
import type { AuthenticationSessionRepositoryHolder } from '../../helpers/authentication-session-repository-holder';
import type { AuthenticationContext } from '../../types/contexts';

class GenerateChallengeStep<Account extends AccountModel> implements AuthenticationStep<Account> {
	private readonly nonceSize: number;

	public constructor(nonceSize: number) {
		this.nonceSize = nonceSize;
	}

	public async process(
		_account: Account,
		_authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<AuthenticationStepOutput> {
		const authenticationSession = await authenticationSessionRepositoryHolder.get();
		// not checking if a nonce was generated already, it's maybe failed because of network error and needs to be regenerated
		const nonce = await safeUid(this.nonceSize);
		authenticationSession.challengeResponseNonce = nonce; // store for later comparison in challenge response step
		return { done: { token: nonce, nextStep: AuthenticationStepName.CHALLENGE_RESPONSE } };
	}
}

export { GenerateChallengeStep };

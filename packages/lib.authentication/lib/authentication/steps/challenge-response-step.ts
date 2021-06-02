import type { Encoding } from 'crypto';
import { AuthenticationStepName } from '../../types/enums';
import type { AuthenticationStep, AuthenticationStepOutput } from '../step';
import type { AccountModel } from '../../types/models';
import type { AuthenticationSessionRepositoryHolder } from '../../sessions/authentication';
import type { AuthenticationContext } from '../../types/contexts';

type ChallengeResponseValidator = (
	pubKey: string | Buffer,
	nonce: string,
	signature: string | Buffer,
	signAlgorithm: string,
	encoding: Encoding
) => Promise<boolean>;

class ChallengeResponseStep<Account extends AccountModel> implements AuthenticationStep<Account> {
	private readonly validator: ChallengeResponseValidator;

	public constructor(validator: ChallengeResponseValidator) {
		this.validator = validator;
	}

	public async process(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<AuthenticationStepOutput> {
		const authenticationSession = await authenticationSessionRepositoryHolder.get();

		if (!authenticationSession.challengeResponseNonce) {
			return { nextStep: AuthenticationStepName.ERROR };
		}

		if (
			!(await this.validator(
				account.pubKey!,
				authenticationSession.challengeResponseNonce,
				authenticationContext.responseForChallenge!.signature,
				authenticationContext.responseForChallenge!.signAlgorithm,
				authenticationContext.responseForChallenge!.signEncoding
			))
		) {
			return { nextStep: AuthenticationStepName.ERROR }; // follow common auth attempt failure handling
		}

		return { nextStep: AuthenticationStepName.AUTHENTICATED }; // if signature is valid, user is considered authenticated
	}
}

export { ChallengeResponseStep, ChallengeResponseValidator };

import type { BinaryToTextEncoding } from 'crypto';
import { AuthenticationStepName } from '../../types/enums';
import type { AuthenticationStep, AuthenticationStepOutput } from '../step';
import type { AccountModel } from '../../types/models';
import type { AuthenticationSessionRepositoryHolder } from '../../helpers/authentication-session-repository-holder';
import type { AuthenticationContext } from '../../types/contexts';

/**
 * Validates challenge-response *nonce*.
 *
 * @param pubKey			Public key from {@link AccountModel.pubKey}.
 * @param nonce				Plaintext *nonce* sent to client.
 * @param signature			Encrypted *nonce* sent by client.
 * @param signAlgorithm		*nonce* signing algorithm used by client.
 * @param encoding			*nonce* signing encoding used by client.
 *
 * @returns					Whether nonce sent by client matches the one that was sent by server to him.
 */
type ChallengeResponseValidator = (
	pubKey: string | Buffer,
	nonce: string,
	signature: string | Buffer,
	signAlgorithm: string,
	encoding: BinaryToTextEncoding
) => Promise<boolean>;

/**
 * @private
 */
class ChallengeResponseStep<Account extends AccountModel> implements AuthenticationStep<Account> {
	private readonly validator: ChallengeResponseValidator;

	public constructor(validator: ChallengeResponseValidator) {
		this.validator = validator;
	}

	public async process(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<AuthenticationStepOutput<Account>> {
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

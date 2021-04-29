import { Encoding } from 'crypto';
import { AuthStep, AuthStepOutput } from '../auth-step';
import { AuthRequest } from '../../types/requests';
import { AccountModel } from '../../types/models';
import { AUTH_STEP } from '../../types/enums';
import { OnGoingAuthenticationSession } from '../../types/sessions';

type ChallengeResponseValidator = (
	pubKey: string | Buffer,
	nonce: string,
	signature: string | Buffer,
	signAlgorithm: string,
	encoding: Encoding
) => Promise<boolean>;

class ChallengeResponseStep implements AuthStep {
	private readonly validator: ChallengeResponseValidator;

	constructor(validator: ChallengeResponseValidator) {
		this.validator = validator;
	}

	async process(authRequest: AuthRequest, account: AccountModel, session: OnGoingAuthenticationSession): Promise<AuthStepOutput> {
		if (!session.challengeResponseNonce) {
			return { nextStep: AUTH_STEP.ERROR };
		}
		const response = authRequest.responseForChallenge!;
		if (!(await this.validator(account.pubKey!, session.challengeResponseNonce, response.signature, response.signAlgorithm, response.signEncoding))) {
			return { nextStep: AUTH_STEP.ERROR }; // follow common auth attempt failure handling
		}
		return { nextStep: AUTH_STEP.AUTHENTICATED }; // if signature is valid, user is considered authenticated
	}
}

// eslint-disable-next-line no-undef
export { ChallengeResponseStep, ChallengeResponseValidator };

import { HexBase64Latin1Encoding } from 'crypto';
import { AuthStep, AuthStepOutput } from './auth-step';
import { AuthInput } from '../types';
import { Account } from '../models';
import { AUTH_STEP } from '../enums';
import { AuthSession } from '../models/sessions';

type ChallengeResponseValidator = (
	pubKey: string | Buffer,
	nonce: string,
	signature: string | Buffer,
	signAlgorithm: string,
	encoding: HexBase64Latin1Encoding
) => Promise<boolean>;

class ChallengeResponseStep implements AuthStep {
	private readonly validator: ChallengeResponseValidator;

	constructor(validator: ChallengeResponseValidator) {
		this.validator = validator;
	}

	async process(networkInput: AuthInput, account: Account, session: AuthSession): Promise<AuthStepOutput> {
		if (!session.challengeResponseNonce) {
			return { nextStep: AUTH_STEP.ERROR };
		}
		const response = networkInput.responseForChallenge!;
		if (!(await this.validator(account.pubKey!, session.challengeResponseNonce, response.signature, response.signAlgorithm, response.signEncoding))) {
			return { nextStep: AUTH_STEP.ERROR }; // follow common auth attempt failure handling
		}
		return { nextStep: AUTH_STEP.AUTHENTICATED }; // if signature is valid, user is considered authenticated
	}
}

// eslint-disable-next-line no-undef
export { ChallengeResponseStep, ChallengeResponseValidator };

import { AuthStep, AuthStepOutput } from './auth-step';
import { AuthNetworkInput } from '../types';
import { Account } from '../models';
import { AUTH_STEP } from '../enums';

type PubKeyValidator = (pubKey: string | Buffer, signature: string | Buffer, signAlgorithm: string, encoding: string) => Promise<boolean>;

class PubKeyStep implements AuthStep {
	private readonly validator: PubKeyValidator;

	constructor(validator: PubKeyValidator) {
		this.validator = validator;
	}

	async process(networkInput: AuthNetworkInput, account: Account): Promise<AuthStepOutput> {
		const signature = networkInput.signature!;
		if (!(await this.validator(account.pubKey!, signature.nonce, signature.signAlgorithm, signature.encoding))) {
			return { nextStep: AUTH_STEP.ERROR }; // follow common auth attempt failure handling
		}
		return { nextStep: AUTH_STEP.AUTHENTICATED }; // if signature is valid, user is considered authenticated
	}
}

// eslint-disable-next-line no-undef
export { PubKeyStep, PubKeyValidator };

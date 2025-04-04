import { createVerify } from 'crypto';
import type { ChallengeResponseValidator } from '../../lib/authentication/steps/challenge-response-step.js';
import type { RecaptchaValidator } from '../../lib/authentication/steps/recaptcha-step.js';

const recaptchaValidator: RecaptchaValidator = (context) => Promise.resolve(context.recaptcha === 'valid');

const challengeResponseValidator: ChallengeResponseValidator = async (pubKey, nonce, signature, _signAlgorithm, encoding) => {
	return createVerify('RSA-SHA512')
		.update(nonce)
		.verify(pubKey, signature as string, encoding);
};

export { recaptchaValidator, challengeResponseValidator };

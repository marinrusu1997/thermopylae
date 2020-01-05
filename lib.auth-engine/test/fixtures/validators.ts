import { createVerify } from 'crypto';
import { RecaptchaValidator } from '../../lib/authentication/recaptcha-step';
import { ChallengeResponseValidator } from '../../lib/authentication/challenge-response-step';

const recaptchaValidator: RecaptchaValidator = recaptcha => Promise.resolve(recaptcha === 'valid');

const challengeResponseValidator: ChallengeResponseValidator = async (pubKey, nonce, signature, _signAlgorithm, encoding) => {
	return createVerify('RSA-SHA512')
		.update(nonce)
		.verify(pubKey, signature as string, encoding);
};

export { recaptchaValidator, challengeResponseValidator };

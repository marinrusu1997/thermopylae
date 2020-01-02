import { RecaptchaValidator } from '../../lib/authentication/recaptcha-step';

const recaptchaValidator: RecaptchaValidator = recaptcha => Promise.resolve(recaptcha === 'valid');

export { recaptchaValidator };

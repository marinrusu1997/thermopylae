import { ErrorCodes, createException } from '../../../error.js';
import type { AccountModel } from '../../../types/models.js';
import type { PasswordStrengthPolicyValidator } from './policy.js';

/** Validator which ensures that password length is in the valid range. */
class PasswordLengthValidator<Account extends AccountModel> implements PasswordStrengthPolicyValidator<Account> {
	private readonly minLength: number;

	private readonly maxLength: number;

	public constructor(minLength = 12, maxLength = 4096) {
		this.minLength = minLength;
		this.maxLength = maxLength;
	}

	public async validate(password: string): Promise<void | never> {
		if (password.length < this.minLength) {
			throw createException(
				ErrorCodes.WEAK_PASSWORD,
				`Password needs to contain at least ${this.minLength} characters, but it has ${password.length} characters.`
			);
		}

		if (password.length > this.maxLength) {
			throw createException(
				ErrorCodes.WEAK_PASSWORD,
				`Password needs to contain at most ${this.maxLength} characters, but it has ${password.length} characters.`
			);
		}
	}
}

export { PasswordLengthValidator };

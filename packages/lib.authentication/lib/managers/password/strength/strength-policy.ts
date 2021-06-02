import zxcvbn from 'zxcvbn';
import { createException, ErrorCodes } from '../../../error';
import type { PasswordStrengthPolicyValidator } from './policy';
import type { AccountModel } from '../../../types/models';

class PasswordStrengthValidator<Account extends AccountModel> implements PasswordStrengthPolicyValidator<Account> {
	private readonly userInputs: string[];

	public constructor(userInputs: string[] = []) {
		this.userInputs = userInputs;
	}

	public async validate(password: string, account: Account): Promise<void | never> {
		let userInputs: string[];
		if (account.telephone == null) {
			userInputs = [...this.userInputs, account.username, account.email];
		} else {
			userInputs = [...this.userInputs, account.username, account.email, account.telephone];
		}

		const result = zxcvbn(password, userInputs);
		if (result.score < 3) {
			throw createException(
				ErrorCodes.WEAK_PASSWORD,
				`${result.feedback.warning.length ? `${result.feedback.warning}.\n` : ''}${result.feedback.suggestions.join(' ')}`
			);
		}
	}
}

export { PasswordStrengthValidator };

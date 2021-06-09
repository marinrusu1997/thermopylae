import zxcvbn from 'zxcvbn';
import { createException, ErrorCodes } from '../../../error';
import type { PasswordStrengthPolicyValidator } from './policy';
import type { AccountModel } from '../../../types/models';

type UserInputsProvider<Account extends AccountModel> = (account: Account) => string[];

class PasswordStrengthValidator<Account extends AccountModel> implements PasswordStrengthPolicyValidator<Account> {
	private readonly userInputsProvider: UserInputsProvider<Account>;

	public constructor(userInputs: UserInputsProvider<Account>) {
		this.userInputsProvider = userInputs;
	}

	public async validate(password: string, account: Account): Promise<void | never> {
		const result = zxcvbn(password, this.userInputsProvider(account));
		if (result.score < 3) {
			throw createException(
				ErrorCodes.WEAK_PASSWORD,
				`${result.feedback.warning.length ? `${result.feedback.warning}.\n` : ''}${result.feedback.suggestions.join(' ')}`
			);
		}
	}
}

export { PasswordStrengthValidator, UserInputsProvider };

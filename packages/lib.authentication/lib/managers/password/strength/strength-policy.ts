import zxcvbn from 'zxcvbn';
import { ErrorCodes, createException } from '../../../error.js';
import type { AccountModel } from '../../../types/models.js';
import type { PasswordStrengthPolicyValidator } from './policy.js';

/**
 * Function which provides user inputs from the user account to
 * [zxcvbn](https://www.npmjs.com/package/zxcvbn)(see _user_inputs_). <br/> Usually they will be
 * values of the {@link AccountModel.username}, {@link AccountModel.email},
 * {@link AccountModel.telephone} and other sensitive data which can't be used as password.
 */
type UserInputsProvider<Account extends AccountModel> = (account: Account) => string[];

/**
 * Validator which ensures that password is strong enough. It uses
 * [zxcvbn](https://www.npmjs.com/package/zxcvbn).
 */
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

export { PasswordStrengthValidator };
export type { UserInputsProvider };

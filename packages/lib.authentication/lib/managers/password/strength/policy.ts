import type { AccountModel } from '../../../types/models.js';

interface PasswordStrengthPolicyValidator<Account extends AccountModel> {
	/**
	 * Validates password strength.
	 *
	 * @param  password           Provided password by user.
	 * @param  account            Account for which password is validated.
	 *
	 * @throws {Exception}          With {@link ErrorCodes.WEAK_PASSWORD} error code when password is
	 *   weak. <br/> Error message should contain the cause why password is considered weak.
	 */
	validate(password: string, account: Account): Promise<void | never>;
}

export type { PasswordStrengthPolicyValidator };

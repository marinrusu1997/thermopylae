import type { AccountRepository } from '../../types/repositories';
import type { PasswordStrengthPolicyValidator } from './strength/policy';
import type { AccountModel } from '../../types/models';
import type { EmailSender } from '../../side-channels';
import type { ChangePasswordContext } from '../../types/contexts';

/**
 * Manages user passwords. <br/>
 * Implementation ideas were taken from [here](https://paragonie.com/blog/2015/04/secure-authentication-php-with-long-term-persistence#title.2).
 */
class PasswordsManager<Account extends AccountModel> {
	private readonly passwordStrengthPolicies: PasswordStrengthPolicyValidator<Account>[];

	private readonly accountRepository: AccountRepository<Account>;

	private readonly passwordHashing: PasswordHashing;

	private readonly emailSender: EmailSender;

	public constructor(
		passwordHashing: PasswordHashing,
		passwordStrengthPolicies: PasswordStrengthPolicyValidator<Account>[],
		accountRepository: AccountRepository<Account>,
		emailSender: EmailSender
	) {
		this.passwordStrengthPolicies = passwordStrengthPolicies;
		this.accountRepository = accountRepository;
		this.passwordHashing = passwordHashing;
		this.emailSender = emailSender;
	}

	public async validateStrength(password: string, account: Account): Promise<void | never> {
		for (const validator of this.passwordStrengthPolicies) {
			await validator.validate(password, account);
		}
	}

	public async change(newPassword: string, account: Account, context: ChangePasswordContext): Promise<void> {
		await this.validateStrength(newPassword, account);

		const result = await this.hash(newPassword);
		await this.accountRepository.changePassword(account.id, result.passwordHash, result.passwordSalt, result.passwordAlg);

		await this.emailSender.notifyPasswordChanged(account.email, context);
	}

	public hash(password: string): Promise<PasswordHash> {
		return this.passwordHashing.hash(password);
	}

	public isSame(plain: string, hash: PasswordHash): Promise<boolean> {
		return this.passwordHashing.verify(hash, plain);
	}
}

export { PasswordsManager };

import type { UnixTimestamp } from '@thermopylae/core.declarations';
import { createException, ErrorCodes } from '../error';
import { getCurrentTimestamp } from '../utils';
import { AccountStatus } from '../types/enums';
import type { AccountModel } from '../types/models';
import type { EmailSender } from '../types/side-channels';
import type { AccountRepository } from '../types/repositories';
import type { OnAccountDisabledHook } from '../types/hooks';

class AccountManager<Account extends AccountModel> {
	private readonly adminEmail: string;

	private readonly emailSender: EmailSender<Account>;

	private readonly accountRepository: AccountRepository<Account>;

	private readonly onAccountDisabledHook: OnAccountDisabledHook<Account>;

	public constructor(
		adminEmail: string,
		emailSender: EmailSender<Account>,
		accountRepository: AccountRepository<Account>,
		onAccountDisabledHook: OnAccountDisabledHook<Account>
	) {
		this.adminEmail = adminEmail;
		this.emailSender = emailSender;
		this.accountRepository = accountRepository;
		this.onAccountDisabledHook = onAccountDisabledHook;
	}

	public async readById(accountId: string): Promise<Account> {
		const account = await this.accountRepository.readById(accountId);
		if (account == null) {
			throw createException(ErrorCodes.ACCOUNT_NOT_FOUND, `Account with id ${accountId} doesn't exist.`);
		}

		await this.ensureNotDisabled(account);
		return account;
	}

	public async readByUsername(username: string): Promise<Account> {
		const account = await this.accountRepository.readByUsername(username);
		if (account == null) {
			throw createException(ErrorCodes.ACCOUNT_NOT_FOUND, `Account with username '${username}' doesn't exist.`);
		}

		await this.ensureNotDisabled(account);
		return account;
	}

	public async readByEmail(email: string): Promise<Account> {
		const account = await this.accountRepository.readByEmail(email);
		if (account == null) {
			throw createException(ErrorCodes.ACCOUNT_NOT_FOUND, `Account with email ${email} doesn't exist.`);
		}

		await this.ensureNotDisabled(account);
		return account;
	}

	public async readByTelephone(telephone: string): Promise<Account> {
		const account = await this.accountRepository.readByTelephone(telephone);
		if (account == null) {
			throw createException(ErrorCodes.ACCOUNT_NOT_FOUND, `Account with telephone ${telephone} doesn't exist.`);
		}

		await this.ensureNotDisabled(account);
		return account;
	}

	public async enable(accountId: string): Promise<void> {
		await this.accountRepository.setDisabledUntil(accountId, AccountStatus.ENABLED);
	}

	public async disable(account: Account, until: UnixTimestamp | AccountStatus.DISABLED_UNTIL_ACTIVATION, cause: string): Promise<void> {
		account.disabledUntil = until;

		// best effort, we must take at least one of these actions, because it's clearly
		// that something bad happened in the system, if account needs to be disabled
		await Promise.all([
			this.accountRepository.setDisabledUntil(account.id, until),
			this.onAccountDisabledHook(account),
			this.emailSender.notifyAdminAboutAccountDisabling(this.adminEmail, account, cause),
			this.emailSender.notifyAccountDisabled(account, cause)
		]);
	}

	private async ensureNotDisabled(account: Account): Promise<void | never> {
		if (account.disabledUntil === AccountStatus.ENABLED) {
			return;
		}

		if (account.disabledUntil === AccountStatus.DISABLED_UNTIL_ACTIVATION) {
			throw createException(ErrorCodes.ACCOUNT_DISABLED, `Account with id ${account.id} is disabled until it won't be activated.`);
		}

		const currentTimestamp = getCurrentTimestamp();
		if (account.disabledUntil > currentTimestamp) {
			throw createException(ErrorCodes.ACCOUNT_DISABLED, `Account with id ${account.id} is disabled until ${account.disabledUntil}.`);
		}

		account.disabledUntil = AccountStatus.ENABLED;
		await this.accountRepository.setDisabledUntil(account.id, AccountStatus.ENABLED);
	}
}

export { AccountManager, AccountStatus };

import type { UnixTimestamp } from '@thermopylae/core.declarations';
import { createException, ErrorCodes } from '../error';
import { getCurrentTimestamp } from '../utils';
import type { AccountModel } from '../types/models';
import type { EmailSender } from '../side-channels';
import type { AccountRepository } from '../types/repositories';
import type { OnAccountDisabledHook } from '../hooks';

const enum AccountStatus {
	ENABLED = 0,
	DISABLED_UNTIL_ACTIVATION = -1
}

class AccountManager<Account extends AccountModel> {
	private readonly adminEmail: string;

	private readonly emailSender: EmailSender;

	private readonly accountRepository: AccountRepository<Account>;

	private readonly onAccountDisabledHook: OnAccountDisabledHook<Account>;

	public constructor(
		adminEmail: string,
		emailSender: EmailSender,
		accountRepository: AccountRepository<Account>,
		onAccountDisabledHook: OnAccountDisabledHook<Account>
	) {
		this.adminEmail = adminEmail;
		this.emailSender = emailSender;
		this.accountRepository = accountRepository;
		this.onAccountDisabledHook = onAccountDisabledHook;
	}

	public async read(username: string): Promise<Account | null> {
		const account = await this.accountRepository.read(username);
		if (account != null) {
			await this.ensureNotDisabled(account);
		}
		return account;
	}

	public async readById(accountId: string): Promise<Account | null> {
		const account = await this.accountRepository.readById(accountId);
		if (account != null) {
			await this.ensureNotDisabled(account);
		}
		return account;
	}

	public async enable(account: Account): Promise<void> {
		await this.accountRepository.setDisabledUntil(account.id, AccountStatus.ENABLED);
	}

	public async disable(account: Account, until: UnixTimestamp, cause: string): Promise<void> {
		// best effort, we must take at least one of these actions, because it's clearly
		// that something bad happened in the system, if account needs to be disabled
		await Promise.all([
			this.accountRepository.setDisabledUntil(account.id, until),
			this.onAccountDisabledHook(account),
			this.emailSender.notifyAccountDisabled(this.adminEmail, `${cause} Account id: ${account.id}`),
			this.emailSender.notifyAccountDisabled(account.email, cause)
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

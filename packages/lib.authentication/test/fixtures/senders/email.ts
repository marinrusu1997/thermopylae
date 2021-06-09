import { AccountWithTotpSecret, AuthenticationContext, ChangePasswordContext, EmailSender } from '../../../lib';
import { EmailClientMock } from '../mocks/email';

class EmailSenderMock implements EmailSender<AccountWithTotpSecret> {
	public readonly client: EmailClientMock;

	public constructor() {
		this.client = new EmailClientMock();
	}

	public async notifyAccountDisabled(account: AccountWithTotpSecret, cause: string): Promise<void> {
		this.client.send(account.email, 'notifyAccountDisabled', JSON.stringify({ account, cause }));
	}

	public async notifyAdminAboutAccountDisabling(adminEmail: string, account: AccountWithTotpSecret, cause: string): Promise<void> {
		this.client.send(adminEmail, 'notifyAdminAboutAccountDisabling', JSON.stringify({ account, cause }));
	}

	public async notifyAuthenticationFromDifferentDevice(account: AccountWithTotpSecret, authenticationContext: AuthenticationContext): Promise<void> {
		this.client.send(account.email, 'notifyAuthenticationFromDifferentDevice', JSON.stringify(authenticationContext));
	}

	public async notifyMultiFactorAuthenticationFailed(account: AccountWithTotpSecret, authenticationContext: AuthenticationContext): Promise<void> {
		this.client.send(account.email, 'notifyMultiFactorAuthenticationFailed', JSON.stringify(authenticationContext));
	}

	public async notifyPasswordChanged(account: AccountWithTotpSecret, changePasswordContext: ChangePasswordContext): Promise<void> {
		this.client.send(account.email, 'notifyPasswordChanged', JSON.stringify(changePasswordContext));
	}

	public async sendActivateAccountToken(account: AccountWithTotpSecret, token: string): Promise<void> {
		this.client.send(account.email, 'sendActivateAccountToken', token);
	}

	public async sendForgotPasswordToken(account: AccountWithTotpSecret, token: string): Promise<void> {
		this.client.send(account.email, 'sendForgotPasswordToken', token);
	}
}

const EmailSenderInstance = new EmailSenderMock();
Object.freeze(EmailSenderInstance);

export { EmailSenderInstance };

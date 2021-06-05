import { AuthenticationContext, ChangePasswordContext, EmailSender } from '../../../lib';
import { EmailClientMock } from '../mocks/email';

class EmailSenderMock implements EmailSender {
	public readonly client: EmailClientMock;

	public constructor() {
		this.client = new EmailClientMock();
	}

	public async notifyAccountDisabled(emailAddress: string, cause: string): Promise<void> {
		this.client.send(emailAddress, 'notifyAccountDisabled', cause);
	}

	public async notifyAuthenticationFromDifferentDevice(emailAddress: string, authenticationContext: AuthenticationContext): Promise<void> {
		this.client.send(emailAddress, 'notifyAuthenticationFromDifferentDevice', JSON.stringify(authenticationContext));
	}

	public async notifyMultiFactorAuthenticationFailed(emailAddress: string, authenticationContext: AuthenticationContext): Promise<void> {
		this.client.send(emailAddress, 'notifyMultiFactorAuthenticationFailed', JSON.stringify(authenticationContext));
	}

	public async notifyPasswordChanged(emailAddress: string, changePasswordContext: ChangePasswordContext): Promise<void> {
		this.client.send(emailAddress, 'notifyPasswordChanged', JSON.stringify(changePasswordContext));
	}

	public async sendActivateAccountToken(emailAddress: string, token: string): Promise<void> {
		this.client.send(emailAddress, 'sendActivateAccountToken', token);
	}

	public async sendForgotPasswordToken(emailAddress: string, token: string): Promise<void> {
		this.client.send(emailAddress, 'sendForgotPasswordToken', token);
	}
}

const EmailSenderInstance = new EmailSenderMock();
Object.freeze(EmailSenderInstance);

export { EmailSenderInstance };

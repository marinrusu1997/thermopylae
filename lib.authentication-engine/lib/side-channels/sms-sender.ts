import { SmsClient } from '@marin/lib.sms';

type TokenTemplate = (token: string) => string;

interface SmsSendOptions {
	totpTokenTemplate: TokenTemplate;
	forgotPasswordTokenTemplate: TokenTemplate;
}

class SmsSender {
	private readonly smsClient: SmsClient;

	private readonly sendOptions: SmsSendOptions;

	constructor(smsClient: SmsClient, sendOptions: SmsSendOptions) {
		this.smsClient = smsClient;
		this.sendOptions = sendOptions;
	}

	public async sendTotpToken(telephone: string, token: string): Promise<void> {
		await this.smsClient.send(telephone, this.sendOptions.totpTokenTemplate(token));
	}

	public async sendForgotPasswordToken(telephone: string, token: string): Promise<void> {
		await this.smsClient.send(telephone, this.sendOptions.forgotPasswordTokenTemplate(token));
	}
}

export { SmsSender, TokenTemplate, SmsSendOptions };

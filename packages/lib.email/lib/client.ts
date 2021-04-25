import { Transporter, createTransport, SendMailOptions } from 'nodemailer';
import { EmailTransportOptions, EmailTransportDefaults, SentMessageInfo } from './types';
import { getLogger } from './logger';

class EmailClient {
	private transport: Transporter | null;

	/**
	 * Init email client.
	 *
	 * @param options	Options for [nodemailer SMTP transport](https://nodemailer.com/smtp/).
	 * @param defaults	Defaults for [nodemailer SMTP transport](https://nodemailer.com/smtp/).
	 */
	public constructor(options: EmailTransportOptions, defaults?: EmailTransportDefaults) {
		this.transport = createTransport(options, defaults);
		this.transport.on('error', (err) => getLogger().error('Error occurred in email transport.', err));
		this.transport.on('idle', () => getLogger().info('Email transport is idle.'));
	}

	/**
	 * Sends email.
	 *
	 * @param options	Send options.
	 *
	 * @returns		Delivery status.
	 */
	public send(options: SendMailOptions): Promise<SentMessageInfo> {
		return this.transport!.sendMail(options);
	}

	/**
	 * Close email client. No mails can't be sent after.
	 */
	public close(): void {
		this.transport!.close();
		this.transport = null;
	}
}

export { EmailClient, SendMailOptions };

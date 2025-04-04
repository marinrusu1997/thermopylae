import { type SendMailOptions, type Transporter, createTransport } from 'nodemailer';
import type { OnTransportError, OnTransportIdle } from './hooks.js';
import type { EmailTransportDefaults, EmailTransportOptions, SentMessageInfo } from './types.js';

interface EmailClientOptions {
	/** Email transport options. */
	transport: {
		/** Options for [nodemailer SMTP transport](https://nodemailer.com/smtp/). */
		options: EmailTransportOptions;
		/** Defaults for [nodemailer SMTP transport](https://nodemailer.com/smtp/). */
		defaults?: EmailTransportDefaults;
	};
	hooks: {
		onTransportError: OnTransportError;
		onTransportIdle: OnTransportIdle;
	};
}

class EmailClient {
	private transport: Transporter | null;

	/** @param options Options for email client. */
	public constructor(options: EmailClientOptions) {
		this.transport = createTransport(options.transport.options, options.transport.defaults);
		this.transport.on('error', options.hooks.onTransportError);
		this.transport.on('idle', options.hooks.onTransportIdle);
	}

	/**
	 * Sends email.
	 *
	 * @param   options Send options.
	 *
	 * @returns         Delivery status.
	 */
	public send(options: SendMailOptions): Promise<SentMessageInfo> {
		return this.transport!.sendMail(options);
	}

	/** Close email client. No mails can't be sent after. */
	public close(): void {
		this.transport!.close();
		this.transport = null;
	}
}

export { EmailClient, type EmailClientOptions, type SendMailOptions };

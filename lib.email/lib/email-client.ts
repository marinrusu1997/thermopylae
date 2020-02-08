import { Transporter, createTransport, SendMailOptions } from 'nodemailer';
import { EmailTransportOptions, EmailTransportDefaults, SentMessageInfo } from './types';
import { createException, ErrorCodes } from './error';
import { getLogger } from './logger';

class EmailClient {
	private transport: Transporter | undefined | null;

	/**
	 * Inits the email instance. Must be called only once by main module.
	 *
	 * @param options
	 * @param defaults
	 */
	init(options: EmailTransportOptions, defaults?: EmailTransportDefaults): void {
		if (this.transport) {
			throw createException(ErrorCodes.EMAIL_CLIENT_ALREADY_INITIALIZED, 'Email client was initialized before. ');
		}
		this.transport = createTransport(options, defaults);
		this.transport.on('error', err => getLogger().error('Error occurred in email transport. ', err));
		this.transport.on('idle', () => getLogger().info('email transport is idle'));
	}

	/**
	 * Sends an email
	 *
	 * @param {SendMailOptions}	message		Email message which needs to be sent
	 * @param {boolean}       	[strict]  	Flag which ensures that email was delivered to all recipients
	 *
	 * @return {Promise<SentMessageInfo>}
	 */
	async send(message: SendMailOptions, strict?: boolean): Promise<SentMessageInfo> {
		if (!this.transport) {
			throw createException(ErrorCodes.EMAIL_CLIENT_NOT_INITIALIZED, 'Email client needs to be initialized before sending an email. ');
		}
		const info = await this.transport.sendMail(message);
		if (strict && info.accepted.length !== (message.to as []).length) {
			throw createException(ErrorCodes.EMAIL_DELIVERY_FAILED, 'Email was not delivered to all recipients', info);
		}
		return info;
	}

	/**
	 * Unloads the module, by closing underlying transport.
	 * After this method, init can be called again.
	 */
	unload(): void {
		if (!this.transport) {
			throw createException(ErrorCodes.EMAIL_CLIENT_NOT_INITIALIZED, 'Email client needs to be initialized before being unloaded. ');
		}
		this.transport.close();
		this.transport = null;
	}
}

export { EmailClient, SendMailOptions };

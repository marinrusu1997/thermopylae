import { errors } from '@marin/lib.utils';
import { Transporter, createTransport, SendMailOptions } from 'nodemailer';
import { EmailTransportOptions, EmailTransportDefaults, SentMessageInfo } from './types';
import { createException } from './error';
import { getLogger } from './logger';

class Email {
	private transport: Transporter | undefined | null;

	/**
	 * Inits the email instance. Must be called only once by main module.
	 *
	 * @param options
	 * @param defaults
	 */
	init(options: EmailTransportOptions, defaults?: EmailTransportDefaults): void {
		if (this.transport) {
			throw createException(errors.ErrorCodes.ALREADY_INITIALIZED, errors.ErrorMessages.ALREADY_INITIALIZED);
		}
		this.transport = createTransport(options, defaults);
		this.transport.on('error', err => getLogger().error(err));
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
			throw createException(errors.ErrorCodes.NOT_INITIALIZED, errors.ErrorMessages.NOT_INITIALIZED);
		}
		const info = await this.transport.sendMail(message);
		if (strict && info.accepted.length !== (message.to as []).length) {
			throw createException(errors.ErrorCodes.NOT_DELIVERED, 'Email was not delivered to all recipients', info);
		}
		return info;
	}

	/**
	 * Unloads the module, by closing undelying transport.
	 * After this method, init can be called again.
	 */
	unload(): void {
		if (!this.transport) {
			throw createException(errors.ErrorCodes.NOT_INITIALIZED, errors.ErrorMessages.NOT_INITIALIZED);
		}
		this.transport.close();
		this.transport = null;
	}
}

export { Email, EmailTransportOptions, EmailTransportDefaults, SendMailOptions, SentMessageInfo };

import { Transporter, createTransport, SendMailOptions } from 'nodemailer';
import { EmailTransportOptions, EmailTransportDefaults, SentMessageInfo } from './types';
import { createException, ErrorCodes } from './error';
import { getLogger } from './logger';

class EmailClient {
	private transport: Transporter | null;

	constructor(options: EmailTransportOptions, defaults?: EmailTransportDefaults) {
		this.transport = createTransport(options, defaults);
		this.transport.on('error', err => getLogger().error('Error occurred in email transport. ', err));
		this.transport.on('idle', () => getLogger().info('Email transport is idle. '));
	}

	public async send(message: SendMailOptions, strictDelivery = true): Promise<SentMessageInfo> {
		const info = await this.transport!.sendMail(message);
		if (strictDelivery && info.accepted.length !== (message.to as []).length) {
			throw createException(ErrorCodes.EMAIL_DELIVERY_FAILED, 'Email was not delivered to all recipients', info);
		}
		return info;
	}

	public close(): void {
		this.transport!.close();
		this.transport = null;
	}
}

export { EmailClient, SendMailOptions };

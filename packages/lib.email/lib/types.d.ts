// eslint-disable-next-line import/extensions
import SMTPTransport from 'nodemailer/lib/smtp-transport';
// eslint-disable-next-line import/extensions
import SMTPPool from 'nodemailer/lib/smtp-pool';
// eslint-disable-next-line import/extensions
import SendmailTransport from 'nodemailer/lib/sendmail-transport';
// eslint-disable-next-line import/extensions
import StreamTransport from 'nodemailer/lib/stream-transport';
// eslint-disable-next-line import/extensions
import JSONTransport from 'nodemailer/lib/json-transport';
// eslint-disable-next-line import/extensions
import SESTransport from 'nodemailer/lib/ses-transport';
import { Transport, TransportOptions } from 'nodemailer';

export interface SMTPEnvelope {
	/**
	 * The first address gets used as MAIL FROM address in SMTP.
	 */
	from?: string;
	/**
	 * Addresses from this value get added to RCPT TO list.
	 */
	to?: string | Array<string>;
	/**
	 * Addresses from this value get added to RCPT TO list.
	 */
	cc?: string | Array<string>;
	/**
	 * Addresses from this value get added to RCPT TO list.
	 */
	bcc?: string | Array<string>;
}

export interface SentMessageInfo {
	messageId: string;
	accepted: Array<string>;
	rejected: Array<string>;
	envelopeTime: number;
	messageTime: number;
	messageSize: number;
	response: string;
	envelope: SMTPEnvelope;
}

export type EmailTransportOptions =
	| SMTPTransport
	| SMTPTransport.Options
	| string
	| SMTPPool
	| SMTPPool.Options
	| SendmailTransport
	| SendmailTransport.Options
	| StreamTransport
	| StreamTransport.Options
	| JSONTransport
	| JSONTransport.Options
	| SESTransport
	| SESTransport.Options
	| Transport
	| TransportOptions;

export type EmailTransportDefaults =
	| SMTPTransport.Options
	| SMTPPool.Options
	| SendmailTransport.Options
	| StreamTransport.Options
	| JSONTransport.Options
	| SESTransport.Options
	| TransportOptions;

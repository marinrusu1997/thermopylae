import type { Transport, TransportOptions } from 'nodemailer';
import JSONTransport from 'nodemailer/lib/json-transport/index.js';
import SendmailTransport from 'nodemailer/lib/sendmail-transport/index.js';
import SESTransport from 'nodemailer/lib/ses-transport/index.js';
import SMTPPool from 'nodemailer/lib/smtp-pool/index.js';
import SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import StreamTransport from 'nodemailer/lib/stream-transport/index.js';

export interface SMTPEnvelope {
	/** The first address gets used as MAIL FROM address in SMTP. */
	from?: string;
	/** Addresses from this value get added to RCPT TO list. */
	to?: string | Array<string>;
	/** Addresses from this value get added to RCPT TO list. */
	cc?: string | Array<string>;
	/** Addresses from this value get added to RCPT TO list. */
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

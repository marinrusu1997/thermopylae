import type { Transport, TransportOptions } from 'nodemailer';
import type JSONTransport from 'nodemailer/lib/json-transport/index.js';
import type SendmailTransport from 'nodemailer/lib/sendmail-transport/index.js';
import type SESTransport from 'nodemailer/lib/ses-transport/index.js';
import type SMTPPool from 'nodemailer/lib/smtp-pool/index.js';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import type StreamTransport from 'nodemailer/lib/stream-transport/index.js';

interface SMTPEnvelope {
	/** The first address gets used as MAIL FROM address in SMTP. */
	from?: string;
	/** Addresses from this value get added to RCPT TO list. */
	to?: string | Array<string>;
	/** Addresses from this value get added to RCPT TO list. */
	cc?: string | Array<string>;
	/** Addresses from this value get added to RCPT TO list. */
	bcc?: string | Array<string>;
}

interface SentMessageInfo {
	messageId: string;
	accepted: string[];
	rejected: string[];
	envelopeTime: number;
	messageTime: number;
	messageSize: number;
	response: string;
	envelope: SMTPEnvelope;
}

type EmailTransportOptions =
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

type EmailTransportDefaults =
	| SMTPTransport.Options
	| SMTPPool.Options
	| SendmailTransport.Options
	| StreamTransport.Options
	| JSONTransport.Options
	| SESTransport.Options
	| TransportOptions;

export type { SMTPEnvelope, SentMessageInfo, EmailTransportOptions, EmailTransportDefaults };

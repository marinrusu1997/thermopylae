import SMTPTransport from 'nodemailer/lib/smtp-transport';
import SMTPPool from 'nodemailer/lib/smtp-pool';
import SendmailTransport from 'nodemailer/lib/sendmail-transport';
import StreamTransport from 'nodemailer/lib/stream-transport';
import JSONTransport from 'nodemailer/lib/json-transport';
import SESTransport from 'nodemailer/lib/ses-transport';
import { Transport, TransportOptions } from 'nodemailer';

interface SMTPEnvelope {
	/** the first address gets used as MAIL FROM address in SMTP */
	from?: string;
	/** addresses from this value get added to RCPT TO list */
	to?: string | Array<string>;
	/** addresses from this value get added to RCPT TO list */
	cc?: string | Array<string>;
	/** addresses from this value get added to RCPT TO list */
	bcc?: string | Array<string>;
}

interface SentMessageInfo {
	messageId: string;
	accepted: Array<string>;
	rejected: Array<string>;
	envelopeTime: number;
	messageTime: number;
	messageSize: number;
	response: string;
	envelope: SMTPEnvelope;
}

type EmailTransportOptions =
	SMTPTransport | SMTPTransport.Options | string |
	SMTPPool | SMTPPool.Options |
	SendmailTransport | SendmailTransport.Options |
	StreamTransport | StreamTransport.Options |
	JSONTransport | JSONTransport.Options |
	SESTransport | SESTransport.Options |
	Transport | TransportOptions;

type EmailTransportDefaults =
	SMTPTransport.Options |
	SMTPPool.Options |
	SendmailTransport.Options |
	StreamTransport.Options |
	JSONTransport.Options |
	SESTransport.Options |
	TransportOptions;

export { SentMessageInfo, EmailTransportOptions, EmailTransportDefaults };

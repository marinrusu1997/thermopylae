import { describe, it, before } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import { config as dotEnvConfig } from 'dotenv';
import fs from 'fs';
import { EmailClient } from '../lib';

let defaultEmailClient: EmailClient;

describe('email client spec', () => {
	before(async () => {
		const dotEnv = dotEnvConfig();
		if (dotEnv.error) {
			throw dotEnv.error;
		}

		const clientId = process.env['CLIENT_ID'];
		const clientSecret = process.env['CLIENT_SECRET'];
		const refreshToken = process.env['REFRESH_TOKEN'];
		const accessToken = process.env['ACCESS_TOKEN'];
		const user = process.env['USER_EMAIL'];

		defaultEmailClient = new EmailClient({
			transport: {
				options: {
					service: 'gmail',
					auth: {
						type: 'OAuth2',
						user,
						clientId,
						clientSecret,
						refreshToken,
						accessToken
					}
				},
				defaults: {
					from: user
				}
			},
			hooks: {
				onTransportError(err) {
					// eslint-disable-next-line no-console
					console.error(err);
				},
				onTransportIdle() {
					// eslint-disable-next-line no-console
					console.info('Transport idle.');
				}
			}
		});
	});

	it('sends email with text content', async () => {
		const address = 'zcinofares9e@4security.ru';
		const sentEmailInfo = await defaultEmailClient.send({
			to: [address],
			subject: 'Node.js Email with Secure OAuth Text Content',
			text: 'some text'
		});
		expect(sentEmailInfo.response.substr(0, 12)).to.be.equal('250 2.0.0 OK');
	});

	it('sends email with html', async () => {
		const address = 'zcinofares9e@4security.ru';
		const sentEmailInfo = await defaultEmailClient.send({
			to: [address],
			subject: 'Node.js Email with Secure OAuth HTML Content',
			html: '<b>html</b>'
		});
		expect(sentEmailInfo.response.substr(0, 12)).to.be.equal('250 2.0.0 OK');
	});

	it('sends email with text html', async () => {
		const address = 'zcinofares9e@4security.ru';
		const sentEmailInfo = await defaultEmailClient.send({
			to: [address],
			subject: 'Node.js Email with Secure OAuth Text & HTML Content',
			text: 'text',
			html: '<b>html</b>'
		});
		expect(sentEmailInfo.response.substr(0, 12)).to.be.equal('250 2.0.0 OK');
	});

	it('sends email with attachments', async () => {
		// see http://nodemailer.com/message/attachments/
		const address = 'zcinofares9e@4security.ru';
		const sentEmailInfo = await defaultEmailClient.send({
			to: [address],
			subject: 'Node.js Email with attachments',
			html: '<b>html</b>',
			attachments: [
				{
					filename: 'lorem-ipsum.txt',
					content: fs.createReadStream('test/assets/attachment.txt')
				}
			]
		});
		expect(sentEmailInfo.response.substr(0, 12)).to.be.equal('250 2.0.0 OK');
	});

	it('fails to send email if closed', async () => {
		defaultEmailClient.close();

		let err;
		try {
			await defaultEmailClient.send({
				to: ['zcinofares9e@4security.ru'],
				subject: 'Node.js Email with Secure OAuth Text Content',
				text: 'This email should not be sent'
			});
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(TypeError);
	});
});

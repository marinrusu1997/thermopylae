import { expect } from 'chai';
import { describe, it, before } from 'mocha';
import { google } from 'googleapis';
import { config as dotEnvConfig } from 'dotenv';
import Logger from '@marin/lib.logger';
import fs from 'fs';
import { EmailClient } from '../lib';

const { OAuth2 } = google.auth;
let defaultEmailClient: EmailClient;

// fixme try send different types of email

describe('email client spec', () => {
	before(async () => {
		Logger.console.setConfig({ level: 'crit' });

		const dotEnv = dotEnvConfig();
		if (dotEnv.error) {
			throw dotEnv.error;
		}

		const clientId = process.env.CLIENT_ID;
		const clientSecret = process.env.CLIENT_SECRET;
		const redirectURL = process.env.REDIRECT_URL;
		const refreshToken = process.env.REFRESH_TOKEN;
		const user = process.env.USER_EMAIL;

		const oauth2Client = new OAuth2(clientId, clientSecret, redirectURL);

		oauth2Client.setCredentials({
			// eslint-disable-next-line @typescript-eslint/camelcase
			refresh_token: refreshToken
		});

		const getAccessTokenResponse = await oauth2Client.getAccessToken();
		if (!getAccessTokenResponse.token) {
			throw new Error(`no access token ${JSON.stringify(getAccessTokenResponse)}`);
		}

		defaultEmailClient = new EmailClient(
			{
				service: 'gmail',
				auth: {
					type: 'OAuth2',
					user,
					clientId,
					clientSecret,
					refreshToken,
					accessToken: getAccessTokenResponse.token
				}
			},
			{
				from: user
			}
		);
	});

	it('sends email with text content', async () => {
		const address = 'zcinofares9e@4security.ru';
		const sentEmailInfo = await defaultEmailClient.send(
			{
				to: [address],
				subject: 'Node.js Email with Secure OAuth Text Content',
				text: 'some text'
			},
			true
		);
		expect(sentEmailInfo.response.substr(0, 12)).to.be.equal('250 2.0.0 OK');
	});

	it('sends email with text html', async () => {
		const address = 'zcinofares9e@4security.ru';
		const sentEmailInfo = await defaultEmailClient.send(
			{
				to: [address],
				subject: 'Node.js Email with Secure OAuth HTML Content',
				html: '<b>html</b>'
			},
			true
		);
		expect(sentEmailInfo.response.substr(0, 12)).to.be.equal('250 2.0.0 OK');
	});

	it('sends email with text html', async () => {
		const address = 'zcinofares9e@4security.ru';
		const sentEmailInfo = await defaultEmailClient.send(
			{
				to: [address],
				subject: 'Node.js Email with Secure OAuth Text & HTML Content',
				text: 'text',
				html: '<b>html</b>'
			},
			true
		);
		expect(sentEmailInfo.response.substr(0, 12)).to.be.equal('250 2.0.0 OK');
	});

	it('sends email with attachments', async () => {
		// see http://nodemailer.com/message/attachments/
		const address = 'zcinofares9e@4security.ru';
		const sentEmailInfo = await defaultEmailClient.send(
			{
				to: [address],
				subject: 'Node.js Email with attachments',
				html: '<b>html</b>',
				attachments: [
					{
						filename: 'lorem-ipsum.txt',
						content: fs.createReadStream('test/assets/attachment.txt')
					}
				]
			},
			true
		);
		expect(sentEmailInfo.response.substr(0, 12)).to.be.equal('250 2.0.0 OK');
	});

	it('fails to send email if closed', async () => {
		defaultEmailClient.close();

		let err;
		try {
			await defaultEmailClient.send(
				{
					to: ['zcinofares9e@4security.ru'],
					subject: 'Node.js Email with Secure OAuth Text Content',
					text: 'This email should not be sent'
				},
				true
			);
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(TypeError);
	});
});

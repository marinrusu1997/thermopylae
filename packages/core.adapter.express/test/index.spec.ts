import { after, before, describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import type { HttpDevice, HttpHeaderValue, HttpRequestHeader, ObjMap } from '@thermopylae/core.declarations';
import { HttpStatusCode, MimeExt, MimeType } from '@thermopylae/core.declarations';
import type { Server } from 'http';
import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import fetch from 'node-fetch';
import { serialize } from 'cookie';
import { ExpressRequestAdapter, ExpressResponseAdapter } from '../lib';

const app = express();
app.set('trust proxy', true);
app.use(bodyParser.json());
app.use(cookieParser());

const port = 3569;
let server: Server;

let request: {
	ip: string;
	body: ObjMap;
	device: HttpDevice | null;
	headers: Partial<Record<HttpRequestHeader, HttpHeaderValue | undefined>>;
	cookies: ObjMap;
	params: ObjMap;
	query: ObjMap;
};

app.post('/:pp1/:pp2', (req, res) => {
	const requestAdapter = new ExpressRequestAdapter<ObjMap>(req);
	request = {
		ip: requestAdapter.ip,
		body: requestAdapter.body,
		device: requestAdapter.device,
		headers: {
			Referer: requestAdapter.header('Referer')
		},
		cookies: {
			sid: requestAdapter.cookie('sid'),
			pref: requestAdapter.cookie('pref')
		},
		params: {
			pp1: requestAdapter.param('pp1'),
			pp2: requestAdapter.param('pp2')
		},
		query: {
			q1: requestAdapter.query('q1'),
			q2: requestAdapter.query('q2')
		}
	};

	const responseAdapter = new ExpressResponseAdapter(res);
	responseAdapter
		.status(HttpStatusCode.Ok)
		.header('Set-Cookie', 'pref=programming,workout')
		.header('Set-Cookie', 'sid=456')
		.type(MimeExt.JSON)
		.send({ wave: 'to-you' });

	expect(responseAdapter.sent).to.be.eq(true);
});

describe('Express http adapters spec', () => {
	before((done) => {
		server = app.listen(port, done);
	});

	after((done) => {
		server.close(done);
	});

	it('should send a request and receive a response', async () => {
		const response = await fetch(`http://localhost:${port}/par1/par2?q1=1&q2=q`, {
			method: 'post',
			body: JSON.stringify({ hello: 'world' }),
			headers: {
				'Content-Type': MimeType.JSON,
				Cookie: [
					serialize('sid', '123', {
						maxAge: 1000,
						httpOnly: true,
						secure: true,
						path: '/',
						sameSite: 'strict',
						domain: `localhost:${port}`
					}),
					serialize('pref', 'bike,car', {
						expires: new Date('01 Aug 2021 00:00:00 GMT'),
						secure: true,
						sameSite: 'lax'
					})
				].join('; '),
				'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36',
				Referer: 'https://example.com/page?q=123',
				'X-Forwarded-For': '192.168.5.5'
			} as Record<HttpRequestHeader, string>
		});

		expect(request.ip).to.be.eq('192.168.5.5');
		expect(request.body).to.be.deep.eq({ hello: 'world' });
		expect(request.device).to.be.deep.eq({
			bot: null,
			client: {
				engine: 'Blink',
				engineVersion: '',
				name: 'Chrome',
				type: 'browser',
				version: '51.0'
			},
			device: {
				brand: '',
				model: '',
				type: 'desktop'
			},
			os: {
				name: 'GNU/Linux',
				platform: 'x64',
				version: ''
			}
		});
		expect(request.headers).to.be.deep.eq({ Referer: 'https://example.com/page?q=123' });
		expect(request.cookies).to.be.deep.eq({
			sid: '123',
			pref: 'bike,car'
		});
		expect(request.params).to.be.deep.eq({
			pp1: 'par1',
			pp2: 'par2'
		});
		expect(request.query).to.be.deep.eq({
			q1: '1',
			q2: 'q'
		});

		expect(response.status).to.be.eq(HttpStatusCode.Ok);
		expect(response.headers.raw()['set-cookie']).to.be.equalTo(['pref=programming,workout', 'sid=456']);
		await expect(response.json()).to.eventually.be.deep.eq({ wave: 'to-you' });
	});
});

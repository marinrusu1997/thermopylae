import { after, before, describe, it } from 'mocha';
import { expect } from '@thermopylae/dev.unit-test';
import type { HttpDevice, HttpHeaderValue, HttpRequestHeader, HTTPRequestLocation, ObjMap } from '@thermopylae/core.declarations';
import { HttpStatusCode, MimeExt, MimeType } from '@thermopylae/core.declarations';
import type { Server } from 'http';
import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import fetch from 'node-fetch';
import { serialize } from 'cookie';
import { ExpressRequestAdapter, ExpressResponseAdapter, LOCATION_SYM } from '../lib';

const app = express();
app.set('trust proxy', true);
app.use(bodyParser.json());
app.use(cookieParser());

const port = 3569;
let server: Server;

let request: {
	ip: string;
	body: ObjMap;
	device: HttpDevice | undefined;
	location: HTTPRequestLocation | undefined;
	headers: Partial<Record<HttpRequestHeader, HttpHeaderValue | undefined>>;
	cookies: ObjMap;
	params: ObjMap;
	query: ObjMap;
};

app.post('/:pp1/:pp2', (req, res) => {
	const requestAdapter = new ExpressRequestAdapter(req);
	requestAdapter.raw[LOCATION_SYM] = requestAdapter.body as HTTPRequestLocation;

	request = {
		ip: requestAdapter.ip,
		body: requestAdapter.body,
		device: requestAdapter.device && requestAdapter.device, // force to get in from cached property
		location: requestAdapter.location,
		headers: {
			referer: requestAdapter.header('referer')
		},
		cookies: {
			sid: requestAdapter.cookie('sid'),
			pref: requestAdapter.cookie('pref'),
			'not-existing': requestAdapter.cookie('not-existing')
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
		const location: HTTPRequestLocation = {
			countryCode: 'US',
			regionCode: 'AZ',
			city: 'Las Vegas',
			latitude: 45.5,
			longitude: 90.9,
			timezone: 'Arizona/Las Vegas'
		};

		const response = await fetch(`http://localhost:${port}/par1/par2?q1=1&q2=q`, {
			method: 'post',
			body: JSON.stringify(location),
			headers: {
				'content-type': MimeType.JSON,
				cookie: [
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
				'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36',
				referer: 'https://example.com/page?q=123',
				'x-forwarded-for': '192.168.5.5'
			} as Record<HttpRequestHeader, string>
		});

		expect(request.ip).to.be.eq('192.168.5.5');
		expect(request.body).to.be.deep.eq(location);
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
		expect(request.location).to.be.deep.eq(location);
		expect(request.headers).to.be.deep.eq({ referer: 'https://example.com/page?q=123' });
		expect(request.cookies).to.be.deep.eq({
			sid: '123',
			pref: 'bike,car',
			'not-existing': undefined
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

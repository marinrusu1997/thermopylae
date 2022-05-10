import { ObjMap } from '@thermopylae/core.declarations';
import { chai } from '@thermopylae/dev.unit-test';
// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, before, after, it } from 'mocha';
import http, { IncomingMessage, ServerResponse } from 'http';
import { request, requestSecure, HTTPResponse, ErrorCodes } from '../lib/http';
import { generateToken } from './utils';

const { expect } = chai;

describe('http spec', () => {
	let statusCodeForGETRequest = 200;
	let contentTypeForGETRequest = 'application/json';
	let responseForGETRequest: ObjMap | string = { level1: { level2: 'value' } };

	let statusCodeForPOSTRequest = 200;
	let dataWhichWasSentInPOSTReq = '';

	const port = 7481;
	const baseURL = `http://127.0.0.1:${port}/`;
	let server: http.Server;

	before((done) => {
		server = http.createServer((req: IncomingMessage, res: ServerResponse): void => {
			if (req.method === 'GET') {
				res.writeHead(statusCodeForGETRequest, {
					'Content-Type': contentTypeForGETRequest
				});
				res.end(typeof responseForGETRequest === 'string' ? responseForGETRequest : JSON.stringify(responseForGETRequest));
			} else if (req.method === 'POST') {
				let body: Uint8Array[] | string = [];
				req.on('readable', () => {
					const chunk = req.read();
					if (chunk) {
						(body as Uint8Array[]).push(chunk);
					}
				});
				req.on('end', () => {
					body = Buffer.concat(body as Uint8Array[]).toString();
					expect(body).to.be.equal(dataWhichWasSentInPOSTReq);
					res.writeHead(statusCodeForPOSTRequest);
					res.end();
				});
			} else {
				throw new Error('Unknown method');
			}
		});

		server.listen(port, done);
	});

	after((done) => {
		server.close(done);
	});

	it('throws when unsupported status code is received (redirects)', (done) => {
		statusCodeForGETRequest = 300;
		request(baseURL, { method: 'GET' })
			.then(() => done(new Error('should not resolve')))
			.catch((error) => {
				expect(error).to.be.instanceOf(Error);
				expect(error).to.have.property('code', ErrorCodes.REDIRECT_NOT_SUPPORTED);
				expect(error).to.have.property('message', statusCodeForGETRequest.toString());
				done();
			});
	});

	it('makes GET request for text content', async () => {
		statusCodeForGETRequest = 200;
		contentTypeForGETRequest = 'text/plain';
		responseForGETRequest = generateToken(100000);
		const resp = await request(baseURL, { method: 'GET' });
		expect(resp.status).to.be.eq(statusCodeForGETRequest);
		expect(resp.headers['content-type']).to.be.eq(contentTypeForGETRequest);
		expect(resp.data).to.be.deep.equal(responseForGETRequest);
	});

	it('makes GET request for json content', async () => {
		statusCodeForGETRequest = 200;
		contentTypeForGETRequest = 'application/json';
		responseForGETRequest = { level1: { level2: 'value' } };
		const resp = await request(baseURL, { method: 'GET' });
		expect(resp.status).to.be.eq(statusCodeForGETRequest);
		expect(resp.headers['content-type']).to.be.eq(contentTypeForGETRequest);
		expect(resp.data).to.be.deep.equal(responseForGETRequest);
	});

	it('makes GET request for html content', async () => {
		statusCodeForGETRequest = 200;
		contentTypeForGETRequest = 'text/html; charset=utf-8';
		responseForGETRequest = '<head></head>';
		const resp = await request(baseURL, { method: 'GET' });
		expect(resp.status).to.be.eq(statusCodeForGETRequest);
		expect(resp.headers['content-type']).to.be.eq(contentTypeForGETRequest);
		expect(resp.data).to.be.deep.equal(responseForGETRequest);
	});

	it('makes GET request and handles error code in response (400 code)', (done) => {
		statusCodeForGETRequest = 400;
		contentTypeForGETRequest = 'application/json';
		responseForGETRequest = { error: { message: 'failure' } };
		request(baseURL, { method: 'GET' })
			.then(() => done(new Error('should not resolve')))
			.catch((error: HTTPResponse) => {
				expect(error).to.not.be.instanceOf(Error);
				expect(error).to.have.property('status', 400);
				expect(error.headers['content-type']).to.be.eq(contentTypeForGETRequest);
				expect(error.data).to.be.deep.equal(responseForGETRequest);
				done();
			});
	});

	it('makes GET request and handles network errors', (done) => {
		statusCodeForGETRequest = 100;
		request(baseURL, { method: 'GET' })
			.then(() => done(new Error('should not resolve')))
			.catch((error) => {
				expect(error).to.be.instanceOf(Error).and.to.have.property('message', 'socket hang up');
				done();
			});
	});

	it('makes POST request and handles no body response', (done) => {
		statusCodeForPOSTRequest = 200;
		dataWhichWasSentInPOSTReq = generateToken(100000);
		request(baseURL, { method: 'POST' }, { 'content-type': 'application/json', data: dataWhichWasSentInPOSTReq })
			.then((res: HTTPResponse) => {
				expect(res.status).to.be.eq(statusCodeForPOSTRequest);
				expect(res.headers['content-type']).to.be.eq(undefined);
				expect(res.data).to.be.equal(null);
				done();
			})
			.catch((error) => done(error));
	});

	it('makes GET secure request', async () => {
		const resp = await requestSecure('https://jsonplaceholder.typicode.com', { method: 'GET', path: '/todos/1' });
		const expectedJSON: Record<string, unknown> = {
			userId: 1,
			id: 1,
			title: 'delectus aut autem',
			completed: false
		};
		expect(resp.status).to.be.eq(200);
		expect(resp.headers['content-type']).to.be.eq('application/json; charset=utf-8');
		expect(resp.data).to.be.deep.equal(expectedJSON);
	});
});

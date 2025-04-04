import type { ObjMap } from '@thermopylae/core.declarations';
import { IncomingMessage, Server, ServerResponse, createServer } from 'http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ErrorCodes, request, requestSecure } from '../lib/http.js';
import { generateToken } from './utils.js';

describe('http spec', () => {
	let statusCodeForGETRequest = 200;
	let contentTypeForGETRequest = 'application/json';
	let responseForGETRequest: ObjMap | string = { level1: { level2: 'value' } };

	let statusCodeForPOSTRequest = 200;
	let dataWhichWasSentInPOSTReq = '';

	const port = 7481;
	const baseURL = `http://127.0.0.1:${port}/`;
	let server: Server;

	beforeAll(async () => {
		server = await new Promise<Server>((resolve) => {
			const spawnServer = createServer((req: IncomingMessage, res: ServerResponse): void => {
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

			spawnServer.listen(port, undefined, undefined, () => resolve(spawnServer));
		});
	});

	afterAll(async () => {
		await new Promise((resolve) => {
			server.close(resolve);
		});
	});

	it('throws when unsupported status code is received (redirects)', async () => {
		statusCodeForGETRequest = 300;

		let error: Error | null = null;
		try {
			await request(baseURL, { method: 'GET' });
		} catch (e) {
			error = e;
		}
		expect(error).to.be.instanceOf(Error);
		expect(error).to.have.property('code', ErrorCodes.REDIRECT_NOT_SUPPORTED);
		expect(error).to.have.property('message', statusCodeForGETRequest.toString());
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

	it('makes GET request and handles error code in response (400 code)', async () => {
		statusCodeForGETRequest = 400;
		contentTypeForGETRequest = 'application/json';
		responseForGETRequest = { error: { message: 'failure' } };

		let error: Error & ObjMap = new Error();
		try {
			await request(baseURL, { method: 'GET' });
		} catch (e) {
			error = e;
		}
		expect(error).to.not.be.instanceOf(Error);
		expect(error).to.have.property('status', 400);
		expect(error!.headers['content-type']).to.be.eq(contentTypeForGETRequest);
		expect(error!.data).to.be.deep.equal(responseForGETRequest);
	});

	it('makes GET request and handles network errors', { timeout: 10_000 }, async () => {
		statusCodeForGETRequest = 100;

		let error: Error & ObjMap = new Error();
		try {
			await request(baseURL, { method: 'GET' });
		} catch (e) {
			error = e;
		}
		expect(error).to.be.instanceOf(Error).and.to.have.property('message', 'socket hang up');
	});

	it('makes POST request and handles no body response', async () => {
		statusCodeForPOSTRequest = 200;
		dataWhichWasSentInPOSTReq = generateToken(100000);

		const res = await request(baseURL, { method: 'POST' }, { 'content-type': 'application/json', data: dataWhichWasSentInPOSTReq });

		expect(res.status).to.be.eq(statusCodeForPOSTRequest);
		expect(res.headers['content-type']).to.be.eq(undefined);
		expect(res.data).to.be.equal(null);
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

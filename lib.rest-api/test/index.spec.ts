import { before, after, beforeEach, describe, it } from 'mocha';
import { expect, assert } from 'chai';
import { chrono, http } from '@marin/lib.utils';
import { Server } from 'http';
import express, { Application } from 'express';
import { json } from 'body-parser';
import { HttpStatusCode } from '@marin/lib.utils/dist/declarations';
import LoggerInstance, { FormattingManager } from '@marin/lib.logger';
import { RestApiRouterFactory } from '../lib/rest-api-router-factory';
import { AccountRole, defaultJwtInstance, issueJWT, rolesTtlMap } from './fixtures/jwt';
import { ServiceName, ServiceRequestHandlers } from '../lib/types';
import {
	User,
	UserServiceCreateMiddlewareFactory,
	UserServiceDeleteMiddlewareFactory,
	UserServiceEnableMiddlewareFactory,
	UserServiceReadAllMiddlewareFactory,
	UserServiceReadMiddlewareFactory
} from './fixtures/middlewares';

describe('rest spi spec', () => {
	const port = 4567;
	const baseUrl = `http://127.0.0.1:${port}`;
	const basePath = '/api/rest/v1';

	let app: Application;
	let server: Server;
	let defaultJwt: string;

	const defaultJwtAccountRole = AccountRole.USER;

	before(done => {
		LoggerInstance.console.setConfig({ level: 'debug' });
		LoggerInstance.formatting.applyOrderFor(FormattingManager.OutputFormat.PRINTF, true);

		const servicesReqHandlers = new Map<ServiceName, ServiceRequestHandlers>();
		servicesReqHandlers.set('USER_SERVICE', {
			create: UserServiceCreateMiddlewareFactory(),
			read: UserServiceReadMiddlewareFactory(),
			readAll: UserServiceReadAllMiddlewareFactory(),
			enable: UserServiceEnableMiddlewareFactory(),
			delete: UserServiceDeleteMiddlewareFactory()
		});

		app = express();
		app.use(json());
		RestApiRouterFactory.createRouter(defaultJwtInstance, servicesReqHandlers, 'test/fixtures/json-schemas')
			.then(router => {
				app.use(basePath, router);
				server = app.listen(port, e => done(e));
			})
			.catch(e => done(e));
	});

	after(done => {
		server.close(e => done(e));
	});

	beforeEach(() => {
		defaultJwt = issueJWT(defaultJwtAccountRole);
	});

	describe('USER_SERVICE create method spec', () => {
		it('creates user with authenticated request', async () => {
			const user: User = {
				name: 'John',
				surname: 'Doe',
				age: String(18)
			};
			const httpResponse = await http.makeHTTPRequest(
				baseUrl,
				{
					method: 'POST',
					path: `${basePath}/user/new`,
					headers: {
						authorization: `Bearer ${defaultJwt}`
					}
				},
				{
					'content-type': 'application/json',
					data: JSON.stringify(user)
				}
			);
			expect(httpResponse.status).to.be.eq(HttpStatusCode.OK);
			expect(httpResponse.data).to.be.deep.eq(user);
		});

		it('fails to create user with unauthenticated request (no jwt)', async () => {
			try {
				await http.makeHTTPRequest(baseUrl, {
					method: 'POST',
					path: `${basePath}/user/new`
				});
			} catch (e) {
				expect(e.status).to.be.eq(HttpStatusCode.UNAUTHORIZED);
				expect(e.data).to.be.eq(null);
				return;
			}
			assert(false, 'Unauthorized request succeeded');
		});

		it('fails to create user with unauthenticated request (expired jwt)', async () => {
			await chrono.sleep(rolesTtlMap.get(defaultJwtAccountRole)! * 1000);
			try {
				await http.makeHTTPRequest(baseUrl, {
					method: 'POST',
					path: `${basePath}/user/new`,
					headers: {
						authorization: `Bearer ${defaultJwt}`
					}
				});
			} catch (e) {
				expect(e.status).to.be.eq(HttpStatusCode.UNAUTHORIZED);
				expect(e.data).to.be.eq(null);
				return;
			}
			assert(false, 'Unauthorized request succeeded');
		});
	});
});

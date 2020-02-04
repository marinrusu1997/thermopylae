import { before, after, beforeEach, describe, it } from 'mocha';
import { expect, assert } from 'chai';
import { chrono, fs, http } from '@marin/lib.utils';
import { Server } from 'http';
import express, { Application } from 'express';
import { json } from 'body-parser';
import { HttpStatusCode } from '@marin/lib.utils/dist/declarations';
import LoggerInstance, { FormattingManager } from '@marin/lib.logger';
import Exception from '@marin/lib.error';
import { RestApiRouterFactory, ServiceName, ServiceRequestHandlers, ErrorCodes } from '../lib';
import { AccountRole, addJwtToBlacklist, defaultJwtInstance, issueJWT, rolesTtlMap } from './fixtures/jwt';
import {
	User,
	UserServiceCreateMiddlewareFactory,
	UserServiceDeleteMiddlewareFactory,
	UserServiceAboutMiddlewareFactory,
	UserServiceUpdateMiddlewareFactory,
	UserServiceReadMiddlewareFactory
} from './fixtures/middlewares';

const servicesReqHandlers = new Map<ServiceName, ServiceRequestHandlers>();
servicesReqHandlers.set('USER_SERVICE', {
	create: UserServiceCreateMiddlewareFactory(),
	read: UserServiceReadMiddlewareFactory(),
	update: UserServiceUpdateMiddlewareFactory(),
	about: UserServiceAboutMiddlewareFactory(),
	delete: UserServiceDeleteMiddlewareFactory()
});

before(() => {
	LoggerInstance.console.setConfig({ level: 'debug' });
	LoggerInstance.formatting.applyOrderFor(FormattingManager.OutputFormat.PRINTF, true);
});

describe('rest spi spec', () => {
	const port = 4567;
	const baseUrl = `http://127.0.0.1:${port}`;
	const basePath = '/api/rest/v1';

	let app: Application;
	let server: Server;
	let defaultJwt: string;

	const defaultJwtAccountRole = AccountRole.USER;

	before(done => {
		app = express();
		app.use(json());
		RestApiRouterFactory.createRouter(defaultJwtInstance, servicesReqHandlers, 'test/fixtures/rest-api')
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

		it('fails to create user with unauthenticated request (revoked jwt)', async () => {
			await addJwtToBlacklist(defaultJwt);
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

	describe('USER_SERVICE read method spec', () => {
		it('reads user without needing an authorization (sends no token)', async () => {
			const age = 25;
			const response = await http.makeHTTPRequest(baseUrl, {
				method: 'GET',
				path: `${basePath}/user/?age=${age}`
			});
			const expectedUser = {
				name: 'John',
				surname: 'Dee',
				age: '25',
				birth: 'yesterday'
			};
			expect(response.status).to.be.eq(HttpStatusCode.OK);
			expect(response.data).to.be.deep.eq(expectedUser);
		});

		it('reads user without needing an authorization (sends expired token)', async () => {
			await chrono.sleep(rolesTtlMap.get(defaultJwtAccountRole)! * 1000);
			const age = 25;
			const response = await http.makeHTTPRequest(baseUrl, {
				method: 'GET',
				path: `${basePath}/user?age=${age}`
			});
			const expectedUser = {
				name: 'John',
				surname: 'Dee',
				age: '25',
				birth: 'yesterday'
			};
			expect(response.status).to.be.eq(HttpStatusCode.OK);
			expect(response.data).to.be.deep.eq(expectedUser);
		});
	});

	describe('USER_SERVICE update method spec', () => {
		it('updates user without needing an authorization (sends no token)', async () => {
			const address = 'California';
			const response = await http.makeHTTPRequest(baseUrl, {
				method: 'PUT',
				path: `${basePath}/user/update/yesterday/and/25?address=${address}`
			});
			const expectedUser = {
				name: 'John',
				surname: 'Dee',
				age: '25',
				birth: 'yesterday',
				address: 'New York'
			};
			expect(response.status).to.be.eq(HttpStatusCode.OK);
			expect(response.data).to.be.deep.eq(expectedUser);
		});

		it('requires authorization if path is not specified correctly', async () => {
			try {
				await http.makeHTTPRequest(baseUrl, {
					method: 'PUT',
					path: `${basePath}/user/update/yesterday/and/25/?address=California`
				});
			} catch (e) {
				expect(e.status).to.be.eq(HttpStatusCode.UNAUTHORIZED);
				expect(e.data).to.be.eq(null);
				return;
			}
			assert(false, 'Unauthorized request succeeded');
		});

		it('requires authorization if path is specified partially', async () => {
			try {
				await http.makeHTTPRequest(baseUrl, {
					method: 'PUT',
					path: `${basePath}/user/update/yesterday/and?address=California`
				});
			} catch (e) {
				expect(e.status).to.be.eq(HttpStatusCode.UNAUTHORIZED);
				expect(e.data).to.be.eq(null);
				return;
			}
			assert(false, 'Unauthorized request succeeded');
		});

		it('invokes no middleware if path is specified partially, but authorization is present', async () => {
			try {
				await http.makeHTTPRequest(baseUrl, {
					method: 'PUT',
					path: `${basePath}/user/update/yesterday/and?address=California`,
					headers: {
						authorization: `Bearer ${defaultJwt}`
					}
				});
			} catch (e) {
				expect(e.status).to.be.eq(HttpStatusCode.NOT_FOUND);
				expect(e.data).to.be.eq(
					`<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot PUT /api/rest/v1/user/update/yesterday/and</pre>\n</body>\n</html>\n`
				);
				return;
			}
			assert(false, 'Request to inexistent path succeeded');
		});
	});

	describe('USER_SERVICE about method spec', () => {
		it('fails to retrieve about user info with a bad request response, auth is included, but not required (uses last / in path)', async () => {
			const queryParamsJson = { a: 'b' };
			try {
				await http.makeHTTPRequest(baseUrl, {
					method: 'OPTIONS',
					path: `${basePath}/user/about/?a=b`,
					headers: {
						authorization: `Bearer ${defaultJwt}`
					}
				});
			} catch (e) {
				expect(e.status).to.be.eq(HttpStatusCode.BAD_REQUEST);
				expect(e.data).to.be.deep.eq(queryParamsJson);
				return;
			}
			assert(false, 'Request succeeded');
		});

		it('fails to retrieve about user info with a bad request response, auth is included, but not required (does not use last / in path)', async () => {
			const queryParamsJson = { c: 'd' };
			try {
				await http.makeHTTPRequest(baseUrl, {
					method: 'OPTIONS',
					path: `${basePath}/user/about?c=d`,
					headers: {
						authorization: `Bearer ${defaultJwt}`
					}
				});
			} catch (e) {
				expect(e.status).to.be.eq(HttpStatusCode.BAD_REQUEST);
				expect(e.data).to.be.deep.eq(queryParamsJson);
				return;
			}
			assert(false, 'Request succeeded');
		});

		it('can make unauthorized request to path not ending with /', async () => {
			const queryParamsJson = { e: 'f' };
			try {
				await http.makeHTTPRequest(baseUrl, {
					method: 'OPTIONS',
					path: `${basePath}/user/about?e=f`
				});
			} catch (e) {
				expect(e.status).to.be.eq(HttpStatusCode.BAD_REQUEST);
				expect(e.data).to.be.deep.eq(queryParamsJson);
				return;
			}
			assert(false, 'Request succeeded');
		});

		it("can't make unauthorized request to path ending with /", async () => {
			try {
				await http.makeHTTPRequest(baseUrl, {
					method: 'OPTIONS',
					path: `${basePath}/user/about/?e=f`
				});
			} catch (e) {
				expect(e.status).to.be.eq(HttpStatusCode.UNAUTHORIZED);
				expect(e.data).to.be.deep.eq(null);
				return;
			}
			assert(false, 'Request succeeded');
		});
	});

	describe('USER_SERVICE delete method spec', () => {
		it("can't delete users by making authorized request with USER role", async () => {
			try {
				await http.makeHTTPRequest(baseUrl, {
					method: 'DELETE',
					path: `${basePath}/user/remove/all/users?a=b`,
					headers: {
						authorization: `Bearer ${defaultJwt}`
					}
				});
			} catch (e) {
				expect(e.status).to.be.eq(HttpStatusCode.FORBIDDEN);
				expect(e.data).to.be.deep.eq({ a: 'b' });
				return;
			}
			assert(false, 'Request succeeded');
		});

		it("can't make request which is not authorized", async () => {
			try {
				await http.makeHTTPRequest(baseUrl, {
					method: 'DELETE',
					path: `${basePath}/user/remove/all/users?a=b`
				});
			} catch (e) {
				expect(e.status).to.be.eq(HttpStatusCode.UNAUTHORIZED);
				expect(e.data).to.be.deep.eq(null);
				return;
			}
			assert(false, 'Request succeeded');
		});
	});
});

describe('rest api router create method spec', () => {
	beforeEach(() => {
		process.env = {};
	});

	it('createRouter throws when service request handlers not found', async () => {
		const emptyServicesReqHandlers = new Map<ServiceName, ServiceRequestHandlers>();

		let err;
		try {
			await RestApiRouterFactory.createRouter(defaultJwtInstance, emptyServicesReqHandlers, 'test/fixtures/rest-api');
		} catch (e) {
			err = e;
		}

		expect(err)
			.to.be.instanceOf(Exception)
			.and.to.haveOwnProperty('code', ErrorCodes.MISCONFIGURATION_SERVICE_REQUEST_HANDLERS_NOT_FOUND);
		expect(err).to.haveOwnProperty('message', `Couldn't find request handlers for USER_SERVICE service.`);
	});

	it('createRouter throws when method request handlers not found', async () => {
		const noMethodsServicesReqHandlers = new Map<ServiceName, ServiceRequestHandlers>();
		noMethodsServicesReqHandlers.set('USER_SERVICE', {});

		let err;
		try {
			await RestApiRouterFactory.createRouter(defaultJwtInstance, noMethodsServicesReqHandlers, 'test/fixtures/rest-api');
		} catch (e) {
			err = e;
		}

		expect(err)
			.to.be.instanceOf(Exception)
			.and.to.haveOwnProperty('code', ErrorCodes.MISCONFIGURATION_METHOD_REQUEST_HANDLERS_NOT_FOUND);
		expect(err).to.haveOwnProperty('message', `Couldn't find request handlers for create method.`);
	});

	it('tries to read config from XDB_CONFIG_HOME if no explicit config path provided', async () => {
		process.env.XDG_CONFIG_HOME = 'test';
		process.env.APP_NAME = 'fixtures';

		const router = await RestApiRouterFactory.createRouter(defaultJwtInstance, servicesReqHandlers);
		expect(router).to.not.be.eq(undefined);
	});

	it('tries to read config from HOME when no XDB_CONFIG_HOME set if no explicit config path provided', async () => {
		process.env.HOME = 'test/fixtures';
		process.env.APP_NAME = 'app_name';

		const config = await fs.readJsonFromFile('test/fixtures/rest-api/user-service.json');
		await fs.writeJsonToFile('test/fixtures/.config/app_name/rest-api/user-service.json', config);

		const router = await RestApiRouterFactory.createRouter(defaultJwtInstance, servicesReqHandlers);
		expect(router).to.not.be.eq(undefined);
	});
});

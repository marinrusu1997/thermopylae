import { afterEach, before, beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import { AuthServiceMethods } from '@marin/declarations/lib/services';
import { chrono, string } from '@marin/lib.utils';
import { ErrorCodes as AuthEngineErrorCodes } from '@marin/lib.auth-engine';
import { Request } from 'express';
import { HttpStatusCode, Libraries } from '@marin/lib.utils/dist/declarations';
import { AUTH_STEP } from '@marin/lib.auth-engine/dist/types/enums';
import Exception from '@marin/lib.error';
import { AccountRole, LogoutType } from '@marin/declarations/lib/auth';
import { AuthenticationEngineMock } from './mocks/auth-engine';
import { AuthController } from '../lib';
import { ResponseMock } from './mocks/response';
import { checkHttpResponse } from './utils';
import { createException, ErrorCodes } from '../lib/error';

describe('controller spec', () => {
	const authEngineMock = new AuthenticationEngineMock();
	let responseMock: ResponseMock;

	const defaultIp = '127.0.0.1';

	before(() => {
		// @ts-ignore
		AuthController.init(authEngineMock);
	});

	beforeEach(() => {
		responseMock = new ResponseMock();
	});

	afterEach(() => {
		authEngineMock.clearMethodBehaviours();
	});

	describe('authenticate spec', () => {
		it('returns 400 Bad Request on any encountered error without body', async () => {
			// @ts-ignore
			const req: Request = {
				// @ts-ignore
				connection: {
					remoteAddress: defaultIp
				},
				headers: {},
				body: {
					username: string.generateStringOfLength(5),
					password: string.generateStringOfLength(5)
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.AUTHENTICATE, {
				expectingInput: credentials => expect(credentials).to.be.eq(req.body),
				throws: new Error('Database I/O error')
			});

			// @ts-ignore
			await AuthController.authenticate(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.BAD_REQUEST
				},
				{
					called: false
				},
				{
					called: true
				}
			);
		});

		it('returns 200 OK with token in json body when given valid credentials', async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				},
				body: {
					username: string.generateStringOfLength(5),
					password: string.generateStringOfLength(5)
				}
			};
			const token = string.generateStringOfLength(10);

			authEngineMock.setMethodBehaviour(AuthServiceMethods.AUTHENTICATE, {
				expectingInput: credentials => expect(credentials).to.be.eq(req.body),
				returns: { token }
			});

			// @ts-ignore
			await AuthController.authenticate(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.OK
				},
				{
					called: true,
					with: { token }
				}
			);
		});

		it('returns 401 Unauthorized with expected next step in json body when providing invalid credentials', async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.AUTHENTICATE, {
				expectingInput: credentials => expect(credentials).to.be.eq(undefined),
				returns: {
					nextStep: AUTH_STEP.PASSWORD,
					error: {
						soft: createException('SOFT_ERR_CODE', '')
					}
				}
			});

			// @ts-ignore
			await AuthController.authenticate(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.UNAUTHORIZED
				},
				{
					called: true,
					with: {
						nextStep: AUTH_STEP.PASSWORD
					}
				}
			);
		});

		it('returns 202 Accepted with expected next step and token in json body when one of the steps completed successfully', async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				}
			};
			const token = string.generateStringOfLength(10);

			authEngineMock.setMethodBehaviour(AuthServiceMethods.AUTHENTICATE, {
				expectingInput: credentials => expect(credentials).to.be.eq(undefined),
				returns: {
					nextStep: AUTH_STEP.TOTP,
					token
				}
			});

			// @ts-ignore
			await AuthController.authenticate(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.ACCEPTED
				},
				{
					called: true,
					with: {
						nextStep: AUTH_STEP.TOTP,
						token
					}
				}
			);
		});

		it('returns 410 Gone on hard error with no body, such as account locking, or account not activated', async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.AUTHENTICATE, {
				expectingInput: credentials => expect(credentials).to.be.eq(undefined),
				returns: {
					error: {
						hard: createException('HARD_ERR_CODE', '')
					}
				}
			});

			// @ts-ignore
			await AuthController.authenticate(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.GONE
				},
				{
					called: false
				},
				{
					called: true
				}
			);
		});

		it('throws misconfiguration error when is unable to interpret auth engine response', async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.AUTHENTICATE, {
				expectingInput: credentials => expect(credentials).to.be.eq(undefined),
				returns: {
					// @ts-ignore
					unknown: 'property'
				}
			});

			// @ts-ignore
			await AuthController.authenticate(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.BAD_REQUEST
				},
				{
					called: false
				},
				{
					called: true
				}
			);
		});
	});

	describe('register spec', () => {
		it('returns 202 Accepted on successful registration', async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				},
				body: {}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.REGISTER, {
				expectingInput: credentials => expect(credentials).to.be.eq(req.body),
				returns: string.generateStringOfLength(10)
			});

			// @ts-ignore
			await AuthController.register(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.ACCEPTED
				},
				{
					called: false
				},
				{
					called: true
				}
			);
		});

		it('returns 409 Conflict when account with username has been already registered', async () => {
			// @ts-ignore
			const req: Request = {
				// @ts-ignore
				connection: {
					remoteAddress: defaultIp
				},
				headers: {},
				body: {}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.REGISTER, {
				expectingInput: credentials => expect(credentials).to.be.eq(req.body),
				throws: new Exception(Libraries.AUTH_ENGINE, AuthEngineErrorCodes.ACCOUNT_ALREADY_REGISTERED, '')
			});

			// @ts-ignore
			await AuthController.register(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.CONFLICT
				},
				{
					called: true,
					with: {
						code: AuthEngineErrorCodes.ACCOUNT_ALREADY_REGISTERED
					}
				}
			);
		});

		it('returns 400 Bad Request on another errors generated by register method', async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				},
				body: {}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.REGISTER, {
				expectingInput: credentials => expect(credentials).to.be.eq(req.body),
				throws: new Exception(Libraries.AUTH_ENGINE, 'UNHANDLED_ERR_CODE', '')
			});

			// @ts-ignore
			await AuthController.register(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.BAD_REQUEST
				},
				{
					called: true,
					with: {
						code: 'UNHANDLED_ERR_CODE'
					}
				}
			);
		});

		it('rethrows errors which are not emitted by auth engine register method', async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				},
				body: {}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.REGISTER, {
				expectingInput: credentials => expect(credentials).to.be.eq(req.body),
				throws: new Error('Error thrown by other systems')
			});

			let err;
			try {
				// @ts-ignore
				await AuthController.register(req, responseMock);
			} catch (e) {
				err = e;
			}
			expect(err)
				.to.be.instanceOf(Error)
				.and.to.haveOwnProperty('message', 'Error thrown by other systems');

			checkHttpResponse(responseMock);
		});
	});

	describe('activate account spec', () => {
		it('returns 204 No Content when account activated successfully', async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				},
				query: {
					token: string.generateStringOfLength(10)
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.ACTIVATE_ACCOUNT, {
				expectingInput: token => expect(token).to.be.eq(req.query.token),
				returns: undefined
			});

			// @ts-ignore
			await AuthController.activateAccount(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.NO_CONTENT
				},
				{
					called: false
				},
				{
					called: true
				}
			);
		});

		it('returns 400 Bad Request when activate account session not found', async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				},
				query: {
					token: string.generateStringOfLength(10)
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.ACTIVATE_ACCOUNT, {
				expectingInput: token => expect(token).to.be.eq(req.query.token),
				throws: new Exception(Libraries.AUTH_ENGINE, AuthEngineErrorCodes.SESSION_NOT_FOUND, '')
			});

			// @ts-ignore
			await AuthController.activateAccount(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.BAD_REQUEST
				},
				{
					called: true,
					with: {
						code: ErrorCodes.INVALID_TOKEN
					}
				}
			);
		});

		it('rethrows error which was not generated by auth engine activate account method', async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				},
				query: {
					token: string.generateStringOfLength(10)
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.ACTIVATE_ACCOUNT, {
				expectingInput: token => expect(token).to.be.eq(req.query.token),
				throws: new Error('Some I/O error')
			});

			let err;
			try {
				// @ts-ignore
				await AuthController.activateAccount(req, responseMock);
			} catch (e) {
				err = e;
			}
			expect(err)
				.to.be.instanceOf(Error)
				.and.to.haveOwnProperty('message', 'Some I/O error');

			checkHttpResponse(responseMock);
		});
	});

	describe('enable multi factor authentication spec', () => {
		it('returns 204 No Content on successful enabling of multi factor authentication', async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					// @ts-ignore
					enable: true
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						sub: string.generateStringOfLength(10)
					}
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.ENABLE_MULTI_FACTOR_AUTHENTICATION, {
				expectingInput: (accountId, enable) => {
					// @ts-ignore
					expect(accountId).to.be.eq(req.pipeline.jwtPayload.sub);
					expect(enable).to.be.eq(req.query.enable);
				},
				returns: undefined
			});

			// @ts-ignore
			await AuthController.enableMultiFactorAuthentication(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.NO_CONTENT
				},
				{
					called: false
				},
				{
					called: true
				}
			);
		});

		it('throws when jwt payload not present in express object', async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					// @ts-ignore
					enable: true
				}
			};

			let err;
			try {
				// @ts-ignore
				await AuthController.enableMultiFactorAuthentication(req, responseMock);
			} catch (e) {
				err = e;
			}
			expect(err)
				.to.be.instanceOf(TypeError)
				.and.to.haveOwnProperty('message', "Cannot read property 'sub' of undefined");

			checkHttpResponse(responseMock);
		});

		it('throws when auth engine enable multi factor authentication fails', async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					// @ts-ignore
					enable: true
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						sub: string.generateStringOfLength(10)
					}
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.ENABLE_MULTI_FACTOR_AUTHENTICATION, {
				expectingInput: (accountId, enable) => {
					// @ts-ignore
					expect(accountId).to.be.eq(req.pipeline.jwtPayload.sub);
					expect(enable).to.be.eq(req.query.enable);
				},
				throws: new Error('Database I/O error')
			});

			let err;
			try {
				// @ts-ignore
				await AuthController.enableMultiFactorAuthentication(req, responseMock);
			} catch (e) {
				err = e;
			}
			expect(err)
				.to.be.instanceOf(Error)
				.and.to.haveOwnProperty('message', 'Database I/O error');

			checkHttpResponse(responseMock);
		});
	});

	describe('get active sessions spec', () => {
		it('returns 200 Ok with array of active sessions json into body', async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					accountId: string.generateStringOfLength(5)
				}
			};
			const activeSession = {
				accountId: req.query.accountId,
				timestamp: new Date().getTime(),
				devices: ['Chrome'],
				ips: [defaultIp]
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.GET_ACTIVE_SESSIONS, {
				expectingInput: accountId => expect(accountId).to.be.eq(req.query.accountId),
				returns: [activeSession]
			});

			// @ts-ignore
			await AuthController.getActiveSessions(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.OK
				},
				{
					called: true,
					with: [activeSession]
				},
				{
					called: false
				}
			);
		});

		it('throws when auth engine get active sessions fails', async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					accountId: string.generateStringOfLength(5)
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.GET_ACTIVE_SESSIONS, {
				expectingInput: accountId => expect(accountId).to.be.eq(req.query.accountId),
				throws: new Error('Database I/O error')
			});

			let err;
			try {
				// @ts-ignore
				await AuthController.getActiveSessions(req, responseMock);
			} catch (e) {
				err = e;
			}
			expect(err)
				.to.be.instanceOf(Error)
				.and.to.haveOwnProperty('message', 'Database I/O error');

			checkHttpResponse(responseMock);
		});
	});

	describe('get failed authentication attempts spec', () => {
		it('returns 200 Ok with array of failed auth attempts as json body', async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					accountId: string.generateStringOfLength(5),
					// @ts-ignore
					from: new Date().getTime() - 1000 * 60,
					// @ts-ignore
					to: new Date().getTime()
				}
			};
			const failedAuthAttempt = {
				id: string.generateStringOfLength(5),
				accountId: req.query.accountId,
				timestamp: new Date().getTime() - 1000,
				devices: ['Chrome'],
				ips: [defaultIp]
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, {
				expectingInput: (accountId, from, to) => {
					expect(accountId).to.be.eq(req.query.accountId);
					expect(from).to.be.eq(req.query.from);
					expect(to).to.be.eq(req.query.to);
				},
				returns: [failedAuthAttempt]
			});

			// @ts-ignore
			await AuthController.getFailedAuthenticationAttempts(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.OK
				},
				{
					called: true,
					with: [failedAuthAttempt]
				},
				{
					called: false
				}
			);
		});

		it('throws when auth engine get failed auth attempts fails', async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					accountId: string.generateStringOfLength(5),
					// @ts-ignore
					from: new Date().getTime() - 1000 * 60,
					// @ts-ignore
					to: new Date().getTime()
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.GET_FAILED_AUTH_ATTEMPTS, {
				expectingInput: (accountId, from, to) => {
					expect(accountId).to.be.eq(req.query.accountId);
					expect(from).to.be.eq(req.query.from);
					expect(to).to.be.eq(req.query.to);
				},
				throws: new Error('Database I/O error')
			});

			let err;
			try {
				// @ts-ignore
				await AuthController.getFailedAuthenticationAttempts(req, responseMock);
			} catch (e) {
				err = e;
			}
			expect(err)
				.to.be.instanceOf(Error)
				.and.to.haveOwnProperty('message', 'Database I/O error');

			checkHttpResponse(responseMock);
		});
	});

	describe('change password spec', () => {
		it(`returns ${HttpStatusCode.NO_CONTENT} when password changed without logging out other sessions`, async () => {
			// @ts-ignore
			const req: Request = {
				// @ts-ignore
				connection: {
					remoteAddress: defaultIp
				},
				headers: {},
				body: {
					old: string.generateStringOfLength(5),
					new: string.generateStringOfLength(5)
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.CHANGE_PASSWORD, {
				expectingInput: body => expect(body).to.be.deep.eq(req.body),
				returns: undefined
			});

			// @ts-ignore
			await AuthController.changePassword(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.NO_CONTENT
				},
				{
					called: false
				},
				{
					called: true
				}
			);
		});

		it(`returns ${HttpStatusCode.OK} when password changed with logging out other sessions`, async () => {
			// @ts-ignore
			const req: Request = {
				// @ts-ignore
				connection: {
					remoteAddress: defaultIp
				},
				headers: {},
				body: {
					old: string.generateStringOfLength(5),
					new: string.generateStringOfLength(5),
					// @ts-ignore
					logAllOtherSessionsOut: true
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.CHANGE_PASSWORD, {
				expectingInput: body => expect(body).to.be.deep.eq(req.body),
				returns: 1
			});

			// @ts-ignore
			await AuthController.changePassword(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.OK
				},
				{
					called: true,
					with: {
						numberOfLoggedOutSessions: 1
					}
				}
			);
		});

		it(`returns ${HttpStatusCode.NOT_FOUND} when account not found (username is not valid)`, async () => {
			// @ts-ignore
			const req: Request = {
				// @ts-ignore
				connection: {
					remoteAddress: defaultIp
				},
				headers: {},
				body: {
					old: string.generateStringOfLength(5),
					new: string.generateStringOfLength(5),
					// @ts-ignore
					logAllOtherSessionsOut: false
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.CHANGE_PASSWORD, {
				expectingInput: body => expect(body).to.be.deep.eq(req.body),
				throws: new Exception(Libraries.AUTH_ENGINE, AuthEngineErrorCodes.ACCOUNT_NOT_FOUND, '')
			});

			// @ts-ignore
			await AuthController.changePassword(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.NOT_FOUND
				},
				{
					called: true,
					with: {
						code: AuthEngineErrorCodes.ACCOUNT_NOT_FOUND
					}
				}
			);
		});

		it(`returns ${HttpStatusCode.GONE} when account is locked`, async () => {
			// @ts-ignore
			const req: Request = {
				// @ts-ignore
				connection: {
					remoteAddress: defaultIp
				},
				headers: {},
				body: {
					old: string.generateStringOfLength(5),
					new: string.generateStringOfLength(5)
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.CHANGE_PASSWORD, {
				expectingInput: body => expect(body).to.be.deep.eq(req.body),
				throws: new Exception(Libraries.AUTH_ENGINE, AuthEngineErrorCodes.ACCOUNT_LOCKED, '')
			});

			// @ts-ignore
			await AuthController.changePassword(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.GONE
				},
				{
					called: true,
					with: {
						code: AuthEngineErrorCodes.ACCOUNT_LOCKED
					}
				}
			);
		});

		it(`returns ${HttpStatusCode.UNAUTHORIZED} when old password is not valid`, async () => {
			// @ts-ignore
			const req: Request = {
				// @ts-ignore
				connection: {
					remoteAddress: defaultIp
				},
				headers: {},
				body: {
					old: string.generateStringOfLength(5),
					new: string.generateStringOfLength(5),
					// @ts-ignore
					logAllOtherSessionsOut: true
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.CHANGE_PASSWORD, {
				expectingInput: body => expect(body).to.be.deep.eq(req.body),
				throws: new Exception(Libraries.AUTH_ENGINE, AuthEngineErrorCodes.INCORRECT_PASSWORD, '')
			});

			// @ts-ignore
			await AuthController.changePassword(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.UNAUTHORIZED
				},
				{
					called: true,
					with: {
						code: AuthEngineErrorCodes.INCORRECT_PASSWORD
					}
				}
			);
		});

		it(`returns ${HttpStatusCode.BAD_REQUEST} when new password is weak`, async () => {
			// @ts-ignore
			const req: Request = {
				// @ts-ignore
				connection: {
					remoteAddress: defaultIp
				},
				headers: {},
				body: {
					old: string.generateStringOfLength(5),
					new: string.generateStringOfLength(5)
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.CHANGE_PASSWORD, {
				expectingInput: body => expect(body).to.be.deep.eq(req.body),
				throws: new Exception(Libraries.AUTH_ENGINE, AuthEngineErrorCodes.WEAK_PASSWORD, '')
			});

			// @ts-ignore
			await AuthController.changePassword(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.BAD_REQUEST
				},
				{
					called: true,
					with: {
						code: AuthEngineErrorCodes.WEAK_PASSWORD
					}
				}
			);
		});

		it('throws misconfiguration error when error emitted by auth engine could not be interpreted', async () => {
			// @ts-ignore
			const req: Request = {
				// @ts-ignore
				connection: {
					remoteAddress: defaultIp
				},
				headers: {},
				body: {
					old: string.generateStringOfLength(5),
					new: string.generateStringOfLength(5)
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.CHANGE_PASSWORD, {
				expectingInput: body => expect(body).to.be.deep.eq(req.body),
				throws: new Exception(Libraries.AUTH_ENGINE, 'UNKNOWN_ERROR_CODE', '')
			});

			let err;
			try {
				// @ts-ignore
				await AuthController.changePassword(req, responseMock);
			} catch (e) {
				err = e;
			}
			expect(err)
				.to.be.instanceOf(Exception)
				.and.to.haveOwnProperty('code', ErrorCodes.MISCONFIGURATION_STATUS_CODE_COULD_NOT_BE_DETERMINED);

			checkHttpResponse(responseMock);
		});

		it('rethrows errors which are not emitted by auth engine', async () => {
			// @ts-ignore
			const req: Request = {
				// @ts-ignore
				connection: {
					remoteAddress: defaultIp
				},
				headers: {},
				body: {
					old: string.generateStringOfLength(5),
					new: string.generateStringOfLength(5)
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.CHANGE_PASSWORD, {
				expectingInput: body => expect(body).to.be.deep.eq(req.body),
				throws: new Error('Database I/O error')
			});

			let err;
			try {
				// @ts-ignore
				await AuthController.changePassword(req, responseMock);
			} catch (e) {
				err = e;
			}
			expect(err)
				.to.be.instanceOf(Error)
				.and.to.haveOwnProperty('message', 'Database I/O error');

			checkHttpResponse(responseMock);
		});
	});

	describe('create forgot password session spec', () => {
		it(`returns ${HttpStatusCode.ACCEPTED} without body when forgot password session created`, async () => {
			// @ts-ignore
			const req: Request = {
				body: {
					username: string.generateStringOfLength(5),
					'side-channel': 'SMS'
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.CREATE_FORGOT_PASSWORD_SESSION, {
				expectingInput: body => expect(body).to.be.deep.eq(req.body),
				returns: undefined
			});

			// @ts-ignore
			await AuthController.createForgotPasswordSession(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.ACCEPTED
				},
				{
					called: false
				},
				{
					called: true
				}
			);
		});

		it('throws when auth engine fails to create forgot password session', async () => {
			// @ts-ignore
			const req: Request = {
				body: {
					username: string.generateStringOfLength(5),
					'side-channel': 'EMAIL'
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.CREATE_FORGOT_PASSWORD_SESSION, {
				expectingInput: body => expect(body).to.be.deep.eq(req.body),
				throws: new Error('Database I/O error')
			});

			let err;
			try {
				// @ts-ignore
				await AuthController.createForgotPasswordSession(req, responseMock);
			} catch (e) {
				err = e;
			}
			expect(err)
				.to.be.instanceOf(Error)
				.and.to.haveOwnProperty('message', 'Database I/O error');

			checkHttpResponse(responseMock);
		});
	});

	describe('change forgotten password spec', () => {
		it(`returns ${HttpStatusCode.NO_CONTENT} with no body when password changed`, async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				},
				body: {
					token: string.generateStringOfLength(5),
					newPassword: string.generateStringOfLength(5)
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.CHANGE_FORGOTTEN_PASSWORD, {
				expectingInput: body => expect(body).to.be.deep.eq(req.body),
				returns: undefined
			});

			// @ts-ignore
			await AuthController.changeForgottenPassword(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.NO_CONTENT
				},
				{
					called: false
				},
				{
					called: true
				}
			);
		});

		it(`returns ${HttpStatusCode.BAD_REQUEST} with error code body when no session found`, async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				},
				body: {
					token: string.generateStringOfLength(5),
					newPassword: string.generateStringOfLength(5)
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.CHANGE_FORGOTTEN_PASSWORD, {
				expectingInput: body => expect(body).to.be.deep.eq(req.body),
				throws: new Exception(Libraries.AUTH_ENGINE, AuthEngineErrorCodes.SESSION_NOT_FOUND, '')
			});

			// @ts-ignore
			await AuthController.changeForgottenPassword(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.BAD_REQUEST
				},
				{
					called: true,
					with: {
						code: ErrorCodes.INVALID_TOKEN
					}
				}
			);
		});

		it(`returns ${HttpStatusCode.BAD_REQUEST} with error code body when new password is weak`, async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				},
				body: {
					token: string.generateStringOfLength(5),
					newPassword: string.generateStringOfLength(5)
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.CHANGE_FORGOTTEN_PASSWORD, {
				expectingInput: body => expect(body).to.be.deep.eq(req.body),
				throws: new Exception(Libraries.AUTH_ENGINE, AuthEngineErrorCodes.WEAK_PASSWORD, '')
			});

			// @ts-ignore
			await AuthController.changeForgottenPassword(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.BAD_REQUEST
				},
				{
					called: true,
					with: {
						code: AuthEngineErrorCodes.WEAK_PASSWORD
					}
				}
			);
		});

		it('throws misconfiguration error when error emitted by auth engine could not be interpreted', async () => {
			// @ts-ignore
			const req: Request = {
				// @ts-ignore
				connection: {
					remoteAddress: defaultIp
				},
				headers: {},
				body: {
					token: string.generateStringOfLength(5),
					newPassword: string.generateStringOfLength(5)
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.CHANGE_FORGOTTEN_PASSWORD, {
				expectingInput: body => expect(body).to.be.deep.eq(req.body),
				throws: new Exception(Libraries.AUTH_ENGINE, 'UNKNOWN_ERROR_CODE', '')
			});

			let err;
			try {
				// @ts-ignore
				await AuthController.changeForgottenPassword(req, responseMock);
			} catch (e) {
				err = e;
			}
			expect(err)
				.to.be.instanceOf(Exception)
				.and.to.haveOwnProperty('code', ErrorCodes.MISCONFIGURATION_STATUS_CODE_COULD_NOT_BE_DETERMINED);

			checkHttpResponse(responseMock);
		});

		it('rethrows errors which are not emitted by auth engine', async () => {
			// @ts-ignore
			const req: Request = {
				// @ts-ignore
				connection: {
					remoteAddress: defaultIp
				},
				headers: {},
				body: {
					token: string.generateStringOfLength(5),
					newPassword: string.generateStringOfLength(5)
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.CHANGE_FORGOTTEN_PASSWORD, {
				expectingInput: body => expect(body).to.be.deep.eq(req.body),
				throws: new Error('Database I/O error')
			});

			let err;
			try {
				// @ts-ignore
				await AuthController.changeForgottenPassword(req, responseMock);
			} catch (e) {
				err = e;
			}
			expect(err)
				.to.be.instanceOf(Error)
				.and.to.haveOwnProperty('message', 'Database I/O error');

			checkHttpResponse(responseMock);
		});
	});

	describe('validate account credentials spec', () => {
		it(`returns ${HttpStatusCode.OK} when provided credentials are valid`, async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				},
				body: {
					accountId: string.generateStringOfLength(5),
					username: string.generateStringOfLength(5),
					password: string.generateStringOfLength(5)
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.VALIDATE_ACCOUNT_CREDENTIALS, {
				expectingInput: (accountId, credentials) => {
					expect(accountId).to.be.deep.eq(req.body.accountId);
					expect(credentials).to.be.deep.eq(req.body);
				},
				returns: true
			});

			// @ts-ignore
			await AuthController.validateAccountCredentials(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.OK
				},
				{
					called: true,
					with: {
						valid: true
					}
				}
			);
		});

		it(`returns ${HttpStatusCode.NOT_FOUND} when account not found`, async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				},
				body: {
					accountId: string.generateStringOfLength(5),
					username: string.generateStringOfLength(5),
					password: string.generateStringOfLength(5)
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.VALIDATE_ACCOUNT_CREDENTIALS, {
				expectingInput: (accountId, credentials) => {
					expect(accountId).to.be.deep.eq(req.body.accountId);
					expect(credentials).to.be.deep.eq(req.body);
				},
				throws: new Exception(Libraries.AUTH_ENGINE, AuthEngineErrorCodes.ACCOUNT_NOT_FOUND, '')
			});

			// @ts-ignore
			await AuthController.validateAccountCredentials(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.NOT_FOUND
				},
				{
					called: true,
					with: {
						code: AuthEngineErrorCodes.ACCOUNT_NOT_FOUND
					}
				}
			);
		});

		it('rethrows errors which are not emitted by auth engine and have different code than account not found', async () => {
			// @ts-ignore
			const req: Request = {
				// @ts-ignore
				connection: {
					remoteAddress: defaultIp
				},
				headers: {},
				body: {
					accountId: string.generateStringOfLength(5),
					username: string.generateStringOfLength(5),
					password: string.generateStringOfLength(5)
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.VALIDATE_ACCOUNT_CREDENTIALS, {
				expectingInput: (accountId, credentials) => {
					expect(accountId).to.be.deep.eq(req.body.accountId);
					expect(credentials).to.be.deep.eq(req.body);
				},
				throws: new Error('Database I/O error')
			});

			let err;
			try {
				// @ts-ignore
				await AuthController.validateAccountCredentials(req, responseMock);
			} catch (e) {
				err = e;
			}
			expect(err)
				.to.be.instanceOf(Error)
				.and.to.haveOwnProperty('message', 'Database I/O error');

			checkHttpResponse(responseMock);
		});
	});

	describe('change account lock status spec', () => {
		it(`returns ${HttpStatusCode.NO_CONTENT} when locking account successfully`, async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				},
				query: {
					// @ts-ignore
					enable: true
				},
				body: {
					accountId: string.generateStringOfLength(5),
					cause: string.generateStringOfLength(5)
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.CHANGE_ACCOUNT_LOCK_STATUS, {
				expectingInput: (accountId, cause) => {
					expect(accountId).to.be.eq(req.body.accountId);
					expect(cause).to.be.eq(req.body.cause);
				},
				returns: undefined
			});

			// @ts-ignore
			await AuthController.changeAccountLockStatus(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.NO_CONTENT
				},
				{
					called: false
				},
				{
					called: true
				}
			);
		});

		it(`returns ${HttpStatusCode.NO_CONTENT} when unlocking account successfully`, async () => {
			// @ts-ignore
			const req: Request = {
				// @ts-ignore
				connection: {
					remoteAddress: defaultIp
				},
				headers: {},
				query: {
					// @ts-ignore
					enable: false
				},
				body: {
					accountId: string.generateStringOfLength(5)
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.CHANGE_ACCOUNT_LOCK_STATUS, {
				expectingInput: accountId => {
					expect(accountId).to.be.eq(req.body.accountId);
				},
				returns: undefined
			});

			// @ts-ignore
			await AuthController.changeAccountLockStatus(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.NO_CONTENT
				},
				{
					called: false
				},
				{
					called: true
				}
			);
		});

		it(`returns ${HttpStatusCode.NOT_FOUND} when account not found`, async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				},
				query: {
					// @ts-ignore
					enable: false
				},
				body: {
					accountId: string.generateStringOfLength(5)
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.CHANGE_ACCOUNT_LOCK_STATUS, {
				expectingInput: accountId => {
					expect(accountId).to.be.eq(req.body.accountId);
				},
				throws: new Exception(Libraries.AUTH_ENGINE, AuthEngineErrorCodes.ACCOUNT_NOT_FOUND, '')
			});

			// @ts-ignore
			await AuthController.changeAccountLockStatus(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.NOT_FOUND
				},
				{
					called: true,
					with: {
						code: AuthEngineErrorCodes.ACCOUNT_NOT_FOUND
					}
				}
			);
		});

		it('rethrows errors which are not emitted by auth engine and have different code than account not found', async () => {
			// @ts-ignore
			const req: Request = {
				// @ts-ignore
				connection: {
					remoteAddress: defaultIp
				},
				headers: {},
				query: {
					// @ts-ignore
					enable: false
				},
				body: {
					accountId: string.generateStringOfLength(5)
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.CHANGE_ACCOUNT_LOCK_STATUS, {
				expectingInput: accountId => {
					expect(accountId).to.be.eq(req.body.accountId);
				},
				throws: new Error('Database I/O error')
			});

			let err;
			try {
				// @ts-ignore
				await AuthController.changeAccountLockStatus(req, responseMock);
			} catch (e) {
				err = e;
			}
			expect(err)
				.to.be.instanceOf(Error)
				.and.to.haveOwnProperty('message', 'Database I/O error');

			checkHttpResponse(responseMock);
		});
	});

	describe('logout spec', () => {
		it(`returns ${HttpStatusCode.OK} when logging out from current session`, async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				},
				query: {
					type: LogoutType.CURRENT_SESSION
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						sub: string.generateStringOfLength(5),
						aud: AccountRole.USER,
						iat: chrono.dateToUNIX()
					}
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.LOGOUT, {
				// @ts-ignore
				expectingInput: jwtPayload => expect(jwtPayload).to.be.eq(req.pipeline.jwtPayload),
				returns: undefined
			});

			// @ts-ignore
			await AuthController.logout(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.OK
				},
				{
					called: true,
					with: {
						loggedOutSessions: 1
					}
				}
			);
		});

		it(`returns ${HttpStatusCode.OK} when logging out from all sessions`, async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				},
				query: {
					type: LogoutType.ALL_SESSIONS
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						sub: string.generateStringOfLength(5),
						aud: AccountRole.USER,
						iat: chrono.dateToUNIX()
					}
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.LOGOUT_FROM_ALL_DEVICES, {
				// @ts-ignore
				expectingInput: jwtPayload => expect(jwtPayload).to.be.eq(req.pipeline.jwtPayload),
				returns: 3
			});

			// @ts-ignore
			await AuthController.logout(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.OK
				},
				{
					called: true,
					with: {
						loggedOutSessions: 3
					}
				}
			);
		});

		it(`returns ${HttpStatusCode.OK} when logging out from all sessions except current`, async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				},
				query: {
					type: LogoutType.ALL_SESSIONS_EXCEPT_CURRENT
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						sub: string.generateStringOfLength(5),
						aud: AccountRole.USER,
						iat: chrono.dateToUNIX()
					}
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.LOGOUT_FROM_ALL_DEVICE_EXCEPT_FROM_CURRENT, {
				// @ts-ignore
				expectingInput: (accountId, sessionId) => {
					// @ts-ignore
					expect(accountId).to.be.eq(req.pipeline.jwtPayload.sub);
					// @ts-ignore
					expect(sessionId).to.be.eq(req.pipeline.jwtPayload.iat);
				},
				returns: 2
			});

			// @ts-ignore
			await AuthController.logout(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.OK
				},
				{
					called: true,
					with: {
						loggedOutSessions: 2
					}
				}
			);
		});

		it(`returns ${HttpStatusCode.NOT_FOUND} when account couldn't be found`, async () => {
			// @ts-ignore
			const req: Request = {
				// @ts-ignore
				connection: {
					remoteAddress: defaultIp
				},
				headers: {},
				query: {
					type: LogoutType.ALL_SESSIONS
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						sub: string.generateStringOfLength(5),
						aud: AccountRole.USER,
						iat: chrono.dateToUNIX()
					}
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.LOGOUT_FROM_ALL_DEVICES, {
				// @ts-ignore
				expectingInput: jwtPayload => expect(jwtPayload).to.be.eq(req.pipeline.jwtPayload),
				throws: new Exception(Libraries.AUTH_ENGINE, AuthEngineErrorCodes.ACCOUNT_NOT_FOUND, '')
			});

			// @ts-ignore
			await AuthController.logout(req, responseMock);

			checkHttpResponse(
				responseMock,
				{
					called: true,
					with: HttpStatusCode.NOT_FOUND
				},
				{
					called: true,
					with: {
						code: AuthEngineErrorCodes.ACCOUNT_NOT_FOUND
					}
				}
			);
		});

		it('throws misconfiguration error when jwt ttl was not found', async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				},
				query: {
					type: LogoutType.CURRENT_SESSION
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						sub: string.generateStringOfLength(5),
						aud: AccountRole.USER,
						iat: chrono.dateToUNIX()
					}
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.LOGOUT, {
				// @ts-ignore
				expectingInput: jwtPayload => expect(jwtPayload).to.be.eq(req.pipeline.jwtPayload),
				throws: new Exception(Libraries.AUTH_ENGINE, AuthEngineErrorCodes.JWT_TTL_NOT_FOUND, '')
			});

			let err;
			try {
				// @ts-ignore
				await AuthController.logout(req, responseMock);
			} catch (e) {
				err = e;
			}
			expect(err)
				.to.be.instanceOf(Exception)
				.and.to.haveOwnProperty('code', ErrorCodes.MISCONFIGURATION_JWT_TTL_FOR_ACCOUNT_NOT_FOUND_BY_AUTH_ENGINE);

			checkHttpResponse(responseMock);
		});

		it("throws misconfiguration error when auth engine error coundn't be interpretted", async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				},
				query: {
					type: LogoutType.CURRENT_SESSION
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						sub: string.generateStringOfLength(5),
						aud: AccountRole.USER,
						iat: chrono.dateToUNIX()
					}
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.LOGOUT, {
				// @ts-ignore
				expectingInput: jwtPayload => expect(jwtPayload).to.be.eq(req.pipeline.jwtPayload),
				throws: new Exception(Libraries.AUTH_ENGINE, 'UNKNOWN_CODE', '')
			});

			let err;
			try {
				// @ts-ignore
				await AuthController.logout(req, responseMock);
			} catch (e) {
				err = e;
			}
			expect(err)
				.to.be.instanceOf(Exception)
				.and.to.haveOwnProperty('code', ErrorCodes.MISCONFIGURATION_STATUS_CODE_COULD_NOT_BE_DETERMINED);

			checkHttpResponse(responseMock);
		});

		it('rethrows errors which are not emitted by auth engine and have different code than account not found', async () => {
			// @ts-ignore
			const req: Request = {
				// @ts-ignore
				connection: {
					remoteAddress: defaultIp
				},
				headers: {},
				query: {
					type: LogoutType.CURRENT_SESSION
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						sub: string.generateStringOfLength(5),
						aud: AccountRole.USER,
						iat: chrono.dateToUNIX()
					}
				}
			};

			authEngineMock.setMethodBehaviour(AuthServiceMethods.LOGOUT, {
				// @ts-ignore
				expectingInput: jwtPayload => expect(jwtPayload).to.be.eq(req.pipeline.jwtPayload),
				throws: new Error('Database I/O error')
			});

			let err;
			try {
				// @ts-ignore
				await AuthController.logout(req, responseMock);
			} catch (e) {
				err = e;
			}
			expect(err)
				.to.be.instanceOf(Error)
				.and.to.haveOwnProperty('message', 'Database I/O error');

			checkHttpResponse(responseMock);
		});
	});
});

import { before, beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import { Request } from 'express';
import { Firewall } from '@marin/lib.firewall';
import { IpLocation } from '@marin/lib.geoip';
import { HttpStatusCode } from '@marin/lib.utils/dist/declarations';
import { AccountRole, LogoutType } from '@marin/declarations/lib/auth';
import { chrono, object, string } from '@marin/lib.utils';
import { AuthValidator } from '../lib';
import { GeoIpMethods, GeoIpMock } from './mocks/geo-ip';
import { ResponseMock } from './mocks/response';
import { ExpressNextFunction, expressNextFunctionFactory } from './mocks/next-function';
import { checkHttpResponse, ExpectedMethodInvocation } from './utils';
import { ErrorCodes } from '../lib/error';

describe('validator spec', () => {
	const geoIpMock = new GeoIpMock();
	const defaultLocation: IpLocation = {
		countryCode: null,
		city: null,
		latitude: null,
		longitude: null,
		postalCode: null,
		regionCode: null,
		timeZone: null
	};
	const defaultIp = '127.0.0.1';

	let responseMock: ResponseMock;
	let expressNextFunctionMock: ExpressNextFunction;

	before(async () => {
		AuthValidator.init(geoIpMock);
		await Firewall.init('node_modules/@marin/json-schemas/lib/validation', ['core']);
	});

	beforeEach(() => {
		geoIpMock.setBehaviour(GeoIpMethods.LOCATE, {
			expectingInput: ip => expect(ip).to.be.eq(defaultIp),
			returns: defaultLocation
		});
		responseMock = new ResponseMock();
		expressNextFunctionMock = expressNextFunctionFactory();
	});

	function checkValidationPassed(): void {
		expect(expressNextFunctionMock.calls).to.be.eq(1);
		expect(expressNextFunctionMock.args.length).to.be.eq(1);
		expect(expressNextFunctionMock.args[0].length).to.be.eq(0);

		expect(() => responseMock.getStatus()).to.throw('status method not called only once');
		expect(() => responseMock.getJson()).to.throw('json method not called only once');
		expect(() => responseMock.getSend()).to.throw('send method not called only once');
	}

	function checkValidationFailed(
		status: ExpectedMethodInvocation<HttpStatusCode> = { called: false },
		json: ExpectedMethodInvocation<any> = { called: false },
		send: ExpectedMethodInvocation<any> = { called: false }
	): void {
		expect(expressNextFunctionMock.calls).to.be.eq(0);
		checkHttpResponse(responseMock, status, json, send);
	}

	describe('authenticate spec', () => {
		it('accepts valid requests when not behind reverse proxy', async () => {
			// @ts-ignore
			const req: Request = {
				// @ts-ignore
				connection: {
					remoteAddress: defaultIp
				},
				headers: {
					'user-agent': 'Chrome'
				},
				body: {
					username: 'username',
					password: 'long-password'
				}
			};

			// @ts-ignore
			await AuthValidator.authenticate(req, responseMock, expressNextFunctionMock.next);

			checkValidationPassed();
		});

		it('accepts valid requests when behind reverse proxy', async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp,
					'user-agent': 'Chrome'
				},
				body: {
					username: 'username',
					password: 'long-password'
				}
			};

			// @ts-ignore
			await AuthValidator.authenticate(req, responseMock, expressNextFunctionMock.next);

			checkValidationPassed();
		});

		it('rejects requests without ip (i.e. reverse proxy did not set header or smth)', async () => {
			// @ts-ignore
			const req: Request = {
				// @ts-ignore
				connection: {},
				headers: {
					'user-agent': 'Chrome'
				},
				body: {
					username: 'username',
					password: 'long-password'
				}
			};

			// @ts-ignore
			await AuthValidator.authenticate(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed(
				{ called: true, with: HttpStatusCode.BAD_REQUEST },
				{
					called: true,
					with: {
						'': 'should have required property ip'
					}
				}
			);
		});

		it('rejects when user agent request header not present', async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp
				},
				body: {
					username: 'username',
					password: 'long-password'
				}
			};

			// @ts-ignore
			await AuthValidator.authenticate(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed(
				{ called: true, with: HttpStatusCode.BAD_REQUEST },
				{
					called: true,
					with: {
						'': 'should have required property device'
					}
				}
			);
		});

		it("rejects when ip based location couldn't be determined", async () => {
			// @ts-ignore
			const req: Request = {
				headers: {
					'x-forwarded-for': defaultIp,
					'user-agent': 'Chrome'
				},
				body: {
					username: 'username',
					password: 'long-password'
				}
			};
			geoIpMock.setBehaviour(GeoIpMethods.LOCATE, {
				expectingInput: ip => expect(ip).to.be.eq(defaultIp),
				throws: new Error()
			});

			// @ts-ignore
			await AuthValidator.authenticate(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed(
				{ called: true, with: HttpStatusCode.BAD_REQUEST },
				{ called: false },
				{
					called: true
				}
			);
		});
	});

	describe('register spec', () => {
		it('accepts valid requests', async () => {
			// @ts-ignore
			const req: Request = {
				body: {
					username: 'username',
					password: 'long-password',
					email: 'username@example.com',
					telephone: '+4085698'
				}
			};

			// @ts-ignore
			await AuthValidator.register(req, responseMock, expressNextFunctionMock.next);

			checkValidationPassed();
		});

		it('rewrites account role with the USER one', async () => {
			// @ts-ignore
			const req: Request = {
				body: {
					username: 'username',
					password: 'long-password',
					email: 'username@example.com',
					telephone: '+4085698',
					role: AccountRole.ADMIN,
					enableMultiFactorAuth: true
				}
			};

			// @ts-ignore
			await AuthValidator.register(req, responseMock, expressNextFunctionMock.next);

			expect(req.body.role).to.be.eq(AccountRole.USER);
			checkValidationPassed();
		});

		it('rejects invalid body payloads', async () => {
			// @ts-ignore
			const req: Request = {
				body: {
					username: 'username'
				}
			};

			// @ts-ignore
			await AuthValidator.register(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed(
				{ called: true, with: HttpStatusCode.BAD_REQUEST },
				{
					called: true,
					with: {
						'': 'should have required property password'
					}
				}
			);
		});

		it('sanitizes only email, telephone contains only digits', async () => {
			// @ts-ignore
			const req: Request = {
				body: {
					username: 'username',
					password: 'long-password',
					email: 'admin@example.com', // fixme cannot reproduce because of strong ajv validation
					telephone: '+4085698',
					role: AccountRole.ADMIN,
					pubKey: '',
					enableMultiFactorAuth: true
				}
			};
			const bodyCopy = object.cloneDeep(req.body);

			// @ts-ignore
			await AuthValidator.register(req, responseMock, expressNextFunctionMock.next);

			expect(req.body.username).to.be.eq(bodyCopy.username);
			expect(req.body.password).to.be.eq(bodyCopy.password);
			expect(req.body.email).to.be.eq(bodyCopy.email); // fixme cannot reproduce because of strong ajv validation
			expect(req.body.telephone).to.be.eq(bodyCopy.telephone);
			expect(req.body.role).to.be.eq(AccountRole.USER);
			expect(req.body.pubKey).to.be.eq(bodyCopy.pubKey);
			expect(req.body.enableMultiFactorAuth).to.be.eq(bodyCopy.enableMultiFactorAuth);

			checkValidationPassed();
		});
	});

	describe('activate account spec', () => {
		it('accepts valid request', async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					token: string.generateStringOfLength(20, /[a-f0-9]/)
				}
			};

			// @ts-ignore
			await AuthValidator.activateAccount(req, responseMock, expressNextFunctionMock.next);

			checkValidationPassed();
		});

		it('rejects request with no token', async () => {
			// @ts-ignore
			const req: Request = {
				query: {}
			};

			// @ts-ignore
			await AuthValidator.activateAccount(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed(
				{ called: true, with: HttpStatusCode.BAD_REQUEST },
				{
					called: true,
					with: {
						'': 'should have required property activateAccountToken'
					}
				}
			);
		});

		it('rejects request with invalid token', async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					token: string.generateStringOfLength(10)
				}
			};

			// @ts-ignore
			await AuthValidator.activateAccount(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed(
				{ called: true, with: HttpStatusCode.BAD_REQUEST },
				{
					called: false
				},
				{
					called: true
				}
			);
		});
	});

	describe('enable multi factor authentication spec', () => {
		it('accepts valid requests with query param of string type', async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					enable: 'true'
				}
			};

			// @ts-ignore
			await AuthValidator.enableMultiFactorAuthentication(req, responseMock, expressNextFunctionMock.next);

			checkValidationPassed();
		});

		it('accepts valid requests with query param of number type', async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					enable: '0'
				}
			};

			// @ts-ignore
			await AuthValidator.enableMultiFactorAuthentication(req, responseMock, expressNextFunctionMock.next);

			checkValidationPassed();
		});

		it('rejects request when enable query param not found', async () => {
			// @ts-ignore
			const req: Request = {
				query: {}
			};

			// @ts-ignore
			await AuthValidator.enableMultiFactorAuthentication(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed(
				{ called: true, with: HttpStatusCode.BAD_REQUEST },
				{
					called: true,
					with: {
						enable: 'query param is required and needs to be a boolean'
					}
				}
			);
		});

		it("rejects request when enable query param has a value which can't be converted to boolean", async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					enable: 'enable'
				}
			};

			// @ts-ignore
			await AuthValidator.enableMultiFactorAuthentication(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed(
				{ called: true, with: HttpStatusCode.BAD_REQUEST },
				{
					called: true,
					with: {
						enable: 'query param is required and needs to be a boolean'
					}
				}
			);
		});
	});

	describe('get active sessions spec', () => {
		it(`accepts valid requests made by user with ${AccountRole.USER} role`, async () => {
			// @ts-ignore
			const req: Request = {
				query: {},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						sub: string.generateStringOfLength(10, /[a-zA-Z0-9]/),
						aud: AccountRole.USER
					}
				}
			};

			// @ts-ignore
			await AuthValidator.getActiveSessions(req, responseMock, expressNextFunctionMock.next);

			checkValidationPassed();
		});

		it(`accepts valid requests made by user with ${AccountRole.ADMIN} role to retrieve active sessions of another users`, async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					accountId: string.generateStringOfLength(10, /[a-zA-Z0-9]/)
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						aud: AccountRole.ADMIN
					}
				}
			};

			// @ts-ignore
			await AuthValidator.getActiveSessions(req, responseMock, expressNextFunctionMock.next);

			checkValidationPassed();
		});

		it(`accepts valid requests made by user with ${AccountRole.ADMIN} role to retrieve active sessions of itself`, async () => {
			// @ts-ignore
			const req: Request = {
				query: {},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						sub: string.generateStringOfLength(10, /[a-zA-Z0-9]/),
						aud: AccountRole.ADMIN
					}
				}
			};

			// @ts-ignore
			await AuthValidator.getActiveSessions(req, responseMock, expressNextFunctionMock.next);

			checkValidationPassed();
		});

		it("throws when couldn't get jwt payload from request (handled at upper levels as server error)", async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					accountId: string.generateStringOfLength(10, /[a-zA-Z0-9]/)
				}
			};

			let err;
			try {
				// @ts-ignore
				await AuthValidator.getActiveSessions(req, responseMock, expressNextFunctionMock.next);
			} catch (e) {
				err = e;
			}
			expect(err)
				.to.be.instanceOf(TypeError)
				.and.to.haveOwnProperty('message', "Cannot read property 'aud' of undefined");
		});

		it(`is required that only user with ${AccountRole.ADMIN} role can provide an explicit accountId`, async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					accountId: string.generateStringOfLength(10, /[a-zA-Z0-9]/)
				},
				headers: {
					'x-forwarded-for': defaultIp
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						aud: AccountRole.USER
					}
				}
			};

			// @ts-ignore
			await AuthValidator.getActiveSessions(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed(
				{ called: true, with: HttpStatusCode.FORBIDDEN },
				{
					called: false
				},
				{
					called: true
				}
			);
		});

		it(`rejects request with invalid explicit accountId provided by user with ${AccountRole.ADMIN} role`, async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					accountId: string.generateStringOfLength(4)
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						aud: AccountRole.ADMIN
					}
				}
			};

			// @ts-ignore
			await AuthValidator.getActiveSessions(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed(
				{ called: true, with: HttpStatusCode.BAD_REQUEST },
				{
					called: true,
					with: {
						'.accountId': 'should not be shorter than 5 characters'
					}
				}
			);
		});
	});

	describe('get failed authentication attempts spec', () => {
		it(`accepts requests only from user with ${AccountRole.ADMIN} role (without pagination)`, async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					accountId: string.generateStringOfLength(5)
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						sub: string.generateStringOfLength(5),
						aud: AccountRole.ADMIN
					}
				}
			};

			// @ts-ignore
			await AuthValidator.getFailedAuthenticationAttempts(req, responseMock, expressNextFunctionMock.next);

			checkValidationPassed();
		});

		it(`accepts requests only from user with ${AccountRole.ADMIN} role (partial pagination from)`, async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					accountId: string.generateStringOfLength(5),
					from: String(new Date().getTime())
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						sub: string.generateStringOfLength(5),
						aud: AccountRole.ADMIN
					}
				}
			};

			// @ts-ignore
			await AuthValidator.getFailedAuthenticationAttempts(req, responseMock, expressNextFunctionMock.next);

			checkValidationPassed();
		});

		it(`accepts requests only from user with ${AccountRole.ADMIN} role (partial pagination to)`, async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					accountId: string.generateStringOfLength(5),
					to: String(new Date().getTime())
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						sub: string.generateStringOfLength(5),
						aud: AccountRole.ADMIN
					}
				}
			};

			// @ts-ignore
			await AuthValidator.getFailedAuthenticationAttempts(req, responseMock, expressNextFunctionMock.next);

			checkValidationPassed();
		});

		it(`accepts requests only from user with ${AccountRole.ADMIN} role (with pagination)`, async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					accountId: string.generateStringOfLength(5),
					from: String(new Date().getTime()),
					to: String(new Date().getTime())
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						sub: string.generateStringOfLength(5),
						aud: AccountRole.ADMIN
					}
				}
			};

			// @ts-ignore
			await AuthValidator.getFailedAuthenticationAttempts(req, responseMock, expressNextFunctionMock.next);

			checkValidationPassed();
		});

		it('rejects requests when no jwt payload found in the express request object', async () => {
			// @ts-ignore
			const req: Request = {};

			// @ts-ignore
			await AuthValidator.getFailedAuthenticationAttempts(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed({ called: true, with: HttpStatusCode.BAD_REQUEST }, { called: false }, { called: true });
		});

		it(`rejects requests made by users which role is not ${AccountRole.ADMIN}`, async () => {
			// @ts-ignore
			const req: Request = {
				headers: {},
				// @ts-ignore
				connection: {
					remoteAddress: defaultIp
				},
				query: {
					accountId: string.generateStringOfLength(10)
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						sub: string.generateStringOfLength(5),
						aud: AccountRole.USER
					}
				}
			};

			// @ts-ignore
			await AuthValidator.getFailedAuthenticationAttempts(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed({ called: true, with: HttpStatusCode.FORBIDDEN }, { called: false }, { called: true });
		});

		it('rejects invalid requests', async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					accountId: string.generateStringOfLength(4)
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						sub: string.generateStringOfLength(5),
						aud: AccountRole.ADMIN
					}
				}
			};

			// @ts-ignore
			await AuthValidator.getFailedAuthenticationAttempts(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed(
				{ called: true, with: HttpStatusCode.BAD_REQUEST },
				{
					called: true,
					with: {
						'.accountId': 'should not be shorter than 5 characters'
					}
				}
			);
		});
	});

	describe('change password spec', () => {
		it('accepts valid requests', async () => {
			// @ts-ignore
			const req: Request = {
				body: {
					old: string.generateStringOfLength(10),
					new: string.generateStringOfLength(10),
					logAllOtherSessionsOut: true
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						sub: string.generateStringOfLength(5),
						iat: chrono.dateToUNIX()
					}
				}
			};

			// @ts-ignore
			await AuthValidator.changePassword(req, responseMock, expressNextFunctionMock.next);

			checkValidationPassed();
		});

		it('rejects invalid requests', async () => {
			// @ts-ignore
			const req: Request = {
				body: {
					old: string.generateStringOfLength(4)
				}
			};

			// @ts-ignore
			await AuthValidator.changePassword(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed(
				{ called: true, with: HttpStatusCode.BAD_REQUEST },
				{
					called: true,
					with: {
						'.old': 'should not be shorter than 10 characters'
					}
				}
			);
		});

		it('rejects requests without jwt payload', async () => {
			// @ts-ignore
			const req: Request = {
				body: {
					old: string.generateStringOfLength(10),
					new: string.generateStringOfLength(10),
					logAllOtherSessionsOut: false
				}
			};

			// @ts-ignore
			await AuthValidator.changePassword(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed(
				{ called: true, with: HttpStatusCode.BAD_REQUEST },
				{
					called: false
				},
				{
					called: true
				}
			);
		});
	});

	describe('create forgot password session', () => {
		it('accepts valid requests', async () => {
			// @ts-ignore
			const req: Request = {
				body: {
					username: string.generateStringOfLength(10, /[a-zA-Z0-9]/),
					'side-channel': 'EMAIL'
				}
			};

			// @ts-ignore
			await AuthValidator.createForgotPasswordSession(req, responseMock, expressNextFunctionMock.next);

			checkValidationPassed();
		});

		it('rejects invalid requests', async () => {
			// @ts-ignore
			const req: Request = {
				body: {
					username: string.generateStringOfLength(10, /[a-zA-Z0-9]/),
					'side-channel': 'INVALID'
				}
			};

			// @ts-ignore
			await AuthValidator.createForgotPasswordSession(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed(
				{ called: true, with: HttpStatusCode.BAD_REQUEST },
				{
					called: true,
					with: {
						"['side-channel']": 'should be equal to one of predefined values'
					}
				}
			);
		});
	});

	describe('change forgotten password spec', () => {
		it('accepts valid requests', async () => {
			// @ts-ignore
			const req: Request = {
				body: {
					token: string.generateStringOfLength(20, /[a-f0-9]/),
					newPassword: string.generateStringOfLength(10)
				}
			};

			// @ts-ignore
			await AuthValidator.changeForgottenPassword(req, responseMock, expressNextFunctionMock.next);

			checkValidationPassed();
		});

		it('rejects invalid requests', async () => {
			// @ts-ignore
			const req: Request = {
				body: {
					token: string.generateStringOfLength(20, /[a-f0-9]/),
					newPassword: string.generateStringOfLength(9)
				}
			};

			// @ts-ignore
			await AuthValidator.changeForgottenPassword(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed(
				{ called: true, with: HttpStatusCode.BAD_REQUEST },
				{
					called: true,
					with: {
						'.newPassword': 'should not be shorter than 10 characters'
					}
				}
			);
		});
	});

	describe('validate account credentials', () => {
		it('accepts valid requests', async () => {
			// @ts-ignore
			const req: Request = {
				body: {
					accountId: string.generateStringOfLength(10),
					username: string.generateStringOfLength(10, /[a-zA-Z0-9]/),
					password: string.generateStringOfLength(10)
				}
			};

			// @ts-ignore
			await AuthValidator.validateAccountCredentials(req, responseMock, expressNextFunctionMock.next);

			checkValidationPassed();
		});

		it('rejects invalid requests', async () => {
			// @ts-ignore
			const req: Request = {
				body: {
					accountId: string.generateStringOfLength(10),
					username: string.generateStringOfLength(10, /[$%^&]/),
					password: string.generateStringOfLength(10)
				}
			};

			// @ts-ignore
			await AuthValidator.validateAccountCredentials(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed(
				{ called: true, with: HttpStatusCode.BAD_REQUEST },
				{
					called: false
				},
				{
					called: true
				}
			);
		});
	});

	describe('change account lock status', () => {
		it(`accepts valid requests only from users with ${AccountRole.ADMIN} role when enabling lock`, async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					enable: 'true'
				},
				body: {
					accountId: string.generateStringOfLength(10),
					cause: string.generateStringOfLength(10)
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						aud: AccountRole.ADMIN
					}
				}
			};

			// @ts-ignore
			await AuthValidator.changeAccountLockStatus(req, responseMock, expressNextFunctionMock.next);

			checkValidationPassed();
		});

		it(`accepts valid requests only from users with ${AccountRole.ADMIN} role when disabling lock`, async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					enable: 'false'
				},
				body: {
					accountId: string.generateStringOfLength(10)
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						aud: AccountRole.ADMIN
					}
				}
			};

			// @ts-ignore
			await AuthValidator.changeAccountLockStatus(req, responseMock, expressNextFunctionMock.next);

			checkValidationPassed();
		});

		it('rejects requests without jwt payload', async () => {
			// @ts-ignore
			const req: Request = {};

			// @ts-ignore
			await AuthValidator.changeAccountLockStatus(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed(
				{ called: true, with: HttpStatusCode.BAD_REQUEST },
				{
					called: false
				},
				{
					called: true
				}
			);
		});

		it(`rejects requests from users without ${AccountRole.ADMIN} status`, async () => {
			// @ts-ignore
			const req: Request = {
				headers: {},
				query: {},
				body: {
					accountId: string.generateStringOfLength(10)
				},
				// @ts-ignore
				connection: {
					remoteAddress: defaultIp
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						aud: AccountRole.USER
					}
				}
			};

			// @ts-ignore
			await AuthValidator.changeAccountLockStatus(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed(
				{ called: true, with: HttpStatusCode.FORBIDDEN },
				{
					called: false
				},
				{
					called: true
				}
			);
		});

		it('rejects requests which do not contain lock status', async () => {
			// @ts-ignore
			const req: Request = {
				query: {},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						aud: AccountRole.ADMIN
					}
				}
			};

			// @ts-ignore
			await AuthValidator.changeAccountLockStatus(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed(
				{ called: true, with: HttpStatusCode.BAD_REQUEST },
				{
					called: false
				},
				{
					called: true
				}
			);
		});

		it('rejects requests which contain invalid lock status', async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					enabled: 'yep'
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						aud: AccountRole.ADMIN
					}
				}
			};

			// @ts-ignore
			await AuthValidator.changeAccountLockStatus(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed(
				{ called: true, with: HttpStatusCode.BAD_REQUEST },
				{
					called: false
				},
				{
					called: true
				}
			);
		});

		it('rejects requests with invalid body', async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					enable: 'true'
				},
				body: {
					accountId: string.generateStringOfLength(10)
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						aud: AccountRole.ADMIN
					}
				}
			};

			// @ts-ignore
			await AuthValidator.changeAccountLockStatus(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed(
				{ called: true, with: HttpStatusCode.BAD_REQUEST },
				{
					called: true,
					with: {
						'': 'should have required property .cause'
					}
				}
			);
		});

		it('sanitizes cause when enabling lock', async () => {
			// @ts-ignore
			const req: Request = {
				query: {
					enable: 'true'
				},
				body: {
					accountId: string.generateStringOfLength(10),
					cause: `<script>does not matter for tests</script>`
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						aud: AccountRole.ADMIN
					}
				}
			};

			const bodyCopy = object.clone(req.body);

			// @ts-ignore
			await AuthValidator.changeAccountLockStatus(req, responseMock, expressNextFunctionMock.next);

			expect(req.body.cause).to.not.be.eq(bodyCopy.cause);
			expect(req.body.cause).to.be.eq('&lt;script&gt;does not matter for tests&lt;/script&gt;');

			checkValidationPassed();
		});
	});

	describe('logout spec', () => {
		it(`accepts requests with valid logout type ${LogoutType.CURRENT_SESSION}`, () => {
			// @ts-ignore
			const req: Request = {
				query: {
					type: LogoutType.CURRENT_SESSION
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						aud: AccountRole.ADMIN
					}
				}
			};

			// @ts-ignore
			AuthValidator.logout(req, responseMock, expressNextFunctionMock.next);

			checkValidationPassed();
		});

		it(`accepts requests with valid logout type ${LogoutType.ALL_SESSIONS}`, () => {
			// @ts-ignore
			const req: Request = {
				query: {
					type: LogoutType.ALL_SESSIONS
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						aud: AccountRole.ADMIN
					}
				}
			};

			// @ts-ignore
			AuthValidator.logout(req, responseMock, expressNextFunctionMock.next);

			checkValidationPassed();
		});

		it(`accepts requests with valid logout type ${LogoutType.ALL_SESSIONS_EXCEPT_CURRENT}`, () => {
			// @ts-ignore
			const req: Request = {
				query: {
					type: LogoutType.ALL_SESSIONS_EXCEPT_CURRENT
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						aud: AccountRole.ADMIN
					}
				}
			};

			// @ts-ignore
			AuthValidator.logout(req, responseMock, expressNextFunctionMock.next);

			checkValidationPassed();
		});

		it('rejects requests without logout type', () => {
			// @ts-ignore
			const req: Request = {
				query: {},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						aud: AccountRole.ADMIN
					}
				}
			};

			// @ts-ignore
			AuthValidator.logout(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed(
				{ called: true, with: HttpStatusCode.BAD_REQUEST },
				{
					called: true,
					with: {
						type: ErrorCodes.INVALID_LOGOUT_TYPE
					}
				}
			);
		});

		it('rejects requests with invalid logout type', () => {
			// @ts-ignore
			const req: Request = {
				query: {
					type: 'INVALID'
				},
				// @ts-ignore
				pipeline: {
					jwtPayload: {
						aud: AccountRole.ADMIN
					}
				}
			};

			// @ts-ignore
			AuthValidator.logout(req, responseMock, expressNextFunctionMock.next);

			checkValidationFailed(
				{ called: true, with: HttpStatusCode.BAD_REQUEST },
				{
					called: true,
					with: {
						type: ErrorCodes.INVALID_LOGOUT_TYPE
					}
				}
			);
		});
	});
});

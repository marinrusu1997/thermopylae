import { describe, it, before, beforeEach } from 'mocha';
import { chai } from '../chai';
import { Jwt } from '../../lib/auth/jwt';
import { JwtAuthMiddleware, getDefaultFailureHandler } from '../../lib/strategies/express/express';
import { ResponseMock } from '../mocks/ResponseMock';
import { LoggerMock } from '../mocks/LoggerMock';
import { RequestMock } from '../mocks/RequestMock';
import { GenericSpy } from '../spies/generic-spy';

describe('Express Jwt Authenticator Middleware spec', () => {
	const { expect } = chai;
	const respMock = new ResponseMock();
	const reqMock = new RequestMock();
	const logMock = new LoggerMock();
	const spy = new GenericSpy();
	const authorization = 'authorization';

	let jwtAuth;
	let token;
	const expiresIn = 30; // seconds
	const audience = 'audience';
	const subject = 'subject';
	const issuer = 'issuer';
	const verify = {
		subject,
		audience,
		issuer,
		expiresIn
	};
	const tokenPayload = {
		sub: subject,
		aud: audience
	};

	before(() => {
		jwtAuth = new Jwt({
			secret: 'my-secret',
			blacklisting: false
		});
		token = jwtAuth.sign(tokenPayload, {
			expiresIn,
			issuer
		});
	});

	describe('getDefaultFailureHandler function spec', () => {
		beforeEach(() => {
			respMock.reset();
			logMock.reset();
		});

		it('throws when invalid parameters combination provided as args', async () => {
			const failureHandler = getDefaultFailureHandler();
			await expect(failureHandler()).to.eventually.be.rejectedWith('Invalid err & status prametters combination');
			await expect(failureHandler(null, null)).to.eventually.be.rejectedWith(
				'Invalid err & status prametters combination'
			);
			await expect(failureHandler(undefined, null)).to.eventually.be.rejectedWith(
				'Invalid err & status prametters combination'
			);
			await expect(failureHandler(false, null)).to.eventually.be.rejectedWith(
				'Invalid err & status prametters combination'
			);
			await expect(failureHandler('', null)).to.eventually.be.rejectedWith(
				'Invalid err & status prametters combination'
			);
			await expect(failureHandler(0, null)).to.eventually.be.rejectedWith(
				'Invalid err & status prametters combination'
			);
			await expect(failureHandler({}, undefined)).to.eventually.be.rejectedWith(
				'Invalid err & status prametters combination'
			);
			await expect(failureHandler({}, true)).to.eventually.be.rejectedWith(
				'Invalid err & status prametters combination'
			);
		});

		it('returns a failure handler which uses provided logger', async () => {
			const failureHandler = getDefaultFailureHandler(logMock);
			const err = new Error();
			await failureHandler(err, null, respMock);
			logMock.expect({
				err,
				msg: 'Error while authenticating (non jwt related)'
			});
			await failureHandler(err, false, respMock);
			logMock.expect({
				err,
				msg: 'Error while authenticating (jwt related)'
			});
		});

		it("doesn't attempt to log when no logger provided", async () => {
			await expect(getDefaultFailureHandler()(new Error(), null, respMock)).to.eventually.be.fulfilled;
			await expect(getDefaultFailureHandler()(new Error(), false, respMock)).to.eventually.be.fulfilled;
		});

		it('sends 500 error status on non jwt related auth error', async () => {
			const failureHandler = getDefaultFailureHandler(logMock);
			const errMsg = 'My msg';
			await failureHandler(new Error(errMsg), null, respMock);
			respMock.expect({
				statusCode: 500,
				msg: `Server Error. Authentication failed. ${errMsg}`
			});
		});

		it('sends 401 error status on jwt related auth error', async () => {
			const failureHandler = getDefaultFailureHandler(logMock);
			const errMsg = 'My msg';
			await failureHandler(new Error(errMsg), false, respMock);
			respMock.expect({
				statusCode: 401,
				msg: `Unathorized: ${errMsg}`
			});
		});
	});

	describe('JwtAuthMiddleware function spec', () => {
		beforeEach(() => {
			reqMock.reset();
			respMock.reset();
			logMock.reset();
			spy.softReset();
		});

		it('uses unless option if provided, providing functionality to skip some paths', () => {
			const middleware = JwtAuthMiddleware(jwtAuth, {
				unless: {
					path: '/path/to/resource'
				}
			});
			expect(middleware).to.have.property('unless');
		});

		it('uses explicit onFailure handler', async () => {
			reqMock.setHeader(authorization, '');
			const middleware = JwtAuthMiddleware(jwtAuth, {
				onFailure: (err, status, res) => {
					if (err && status === null) {
						res.status(4555);
					}
				}
			});
			await middleware(reqMock, respMock, () => {});
			respMock.expect({
				statusCode: 4555,
				msg: null
			});
		});

		it('calls onFailure handler when no token present in request', async () => {
			const middleware = JwtAuthMiddleware(jwtAuth);
			await middleware(reqMock, respMock, () => {});
			respMock.expect({
				statusCode: 500,
				msg: 'Server Error. Authentication failed. Jwt not present in request'
			});
		});

		it('calls onFailure handler when token validation fails', async () => {
			const middleware = JwtAuthMiddleware(jwtAuth);
			reqMock.setHeader(authorization, 'Bearer invalid token');
			await middleware(reqMock, respMock, () => {
				spy.count('next');
			});
			respMock.expect({
				statusCode: 401,
				msg: 'Unathorized: jwt malformed'
			});
			spy.expect([{ method: 'next', count: undefined }]);
		});

		it('attaches jwt payload on request object, when token validating is successfull', async () => {
			const middleware = JwtAuthMiddleware(jwtAuth, {
				verifyOptsProvider: () => verify
			});
			reqMock.setHeader(authorization, `Bearer ${token}`);
			await middleware(reqMock, respMock, () => {});
			respMock.expect({
				statusCode: null,
				msg: null
			});
			expect(reqMock.jwtPayload).to.have.property('iss', issuer);
			expect(reqMock.jwtPayload).to.have.property('aud', audience);
			expect(reqMock.jwtPayload).to.have.property('sub', subject);
		});

		it('calls next middleware, after token validation was successfull', async () => {
			const middleware = JwtAuthMiddleware(jwtAuth);
			const next = () => {
				spy.count('next');
			};
			reqMock.setHeader(authorization, `Bearer ${token}`);
			await middleware(reqMock, respMock, next);
			respMock.expect({
				statusCode: null,
				msg: null
			});
			spy.expect([{ method: 'next', count: 1 }]);
		});
	});
});

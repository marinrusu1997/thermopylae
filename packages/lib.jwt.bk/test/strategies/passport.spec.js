import { describe, it, before, beforeEach } from 'mocha';
import { Strategy } from 'passport-custom';
import { chai } from '../chai';
import { expectAsyncRes } from '../utils';
import { RequestMock } from '../mocks/RequestMock';
import { Jwt } from '../../lib/auth/jwt';
import { JwtStrategy, Authenticator } from '../../lib/strategies/passport/passport';
import { LoggerMock } from '../mocks/LoggerMock';

describe('Passport Jwt Auth Strategy spec', () => {
	const { expect } = chai;
	const reqMock = new RequestMock();
	const loggerMock = new LoggerMock();
	const jwtBodyParam = 'jwt';

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

	describe('Validator spec', () => {
		beforeEach(() => {
			reqMock.reset();
			loggerMock.reset();
		});

		it('calls done with error, when no token provided', done => {
			const validator = Authenticator(jwtAuth, { extractor: () => null });
			validator(null, e => {
				expectAsyncRes(() => {
					expect(e)
						.to.be.an.instanceOf(Error)
						.and.to.have.property('message', 'Jwt not present in request');
				}, done);
			});
		});

		it('uses default verify opts from Jwt instance, when verifyOptsProvider provided', done => {
			const validatorDefault = Authenticator(jwtAuth);
			reqMock.setBody(jwtBodyParam, token);
			validatorDefault(reqMock, (e, payload) => {
				expectAsyncRes(() => {
					expect(e).to.be.equal(null);
					expect(payload).to.have.property('iss', issuer);
				}, done);
			});
		});

		it('uses verify options returned by verifyOptsProvider, if provided', done => {
			const validatorCustom = Authenticator(jwtAuth, {
				verifyOptsProvider: () => ({ issuer: `${issuer}-invalid` })
			});
			reqMock.setBody(jwtBodyParam, token);
			validatorCustom(reqMock, (e, payload, opts) => {
				expectAsyncRes(() => {
					expect(e).to.be.equal(null);
					expect(payload).to.be.equal(false);
					expect(opts).to.have.property('message', 'Invalid token');
				}, done);
			});
		});

		it('uses custom extractor if provided', done => {
			const validator = Authenticator(jwtAuth, {
				extractor: req => req['my-location']
			});
			validator({ 'my-location': token }, (e, payload) => {
				expectAsyncRes(() => {
					expect(payload).to.have.property('iss', issuer);
				}, done);
			});
		});

		it('uses default attach property name, when no explicit provided', done => {
			const validatorDefault = Authenticator(jwtAuth, {
				verifyOptsProvider: () => verify
			});
			reqMock.setBody(jwtBodyParam, token);
			validatorDefault(reqMock, (e, payload) => {
				expectAsyncRes(() => {
					expect(e).to.be.equal(null);
					expect(payload).to.have.property('iss', issuer);
					expect(reqMock).to.have.property('jwtPayload');
					expect(reqMock.jwtPayload.aud).to.be.equal(tokenPayload.aud);
					expect(reqMock.jwtPayload.sub).to.be.equal(tokenPayload.sub);
				}, done);
			});
		});

		it('uses explicit attach property name, when its provided in options', done => {
			const validator = Authenticator(jwtAuth, {
				verifyOptsProvider: () => verify,
				attach: 'attach.where.[0].i.want'
			});
			reqMock.setBody(jwtBodyParam, token);
			validator(reqMock, (e, payload) => {
				expectAsyncRes(() => {
					expect(e).to.be.equal(null);
					expect(payload).to.have.property('iss', issuer);
					expect(reqMock.attach.where[0].i).to.have.property('want');
					expect(reqMock.attach.where[0].i.want.aud).to.be.equal(tokenPayload.aud);
					expect(reqMock.attach.where[0].i.want.sub).to.be.equal(tokenPayload.sub);
				}, done);
			});
		});

		it('will log failed attempts to onGet endpoint with an invalid token', done => {
			const authenticator = Authenticator(jwtAuth, {
				verifyOptsProvider: () => verify,
				logger: loggerMock
			});
			reqMock.setBody(jwtBodyParam, 'invalid token');
			authenticator(reqMock, (e, payload) => {
				expectAsyncRes(() => {
					expect(e).to.be.equal(null);
					expect(payload).to.be.equal(false);
					/* We can't make use of the same error as it were thrown */
					loggerMock.err = null;
					loggerMock.expect({
						err: null,
						msg: `Request: ${JSON.stringify(reqMock)}`
					});
				}, done);
			});
		});
	});

	describe('jwtStrategy spec', () => {
		it('returns an instance of passport Strategy class', () => {
			expect(JwtStrategy(jwtAuth)).to.be.an.instanceOf(Strategy);
		});
	});
});

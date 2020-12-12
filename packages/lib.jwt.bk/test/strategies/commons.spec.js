import { describe, it, beforeEach } from 'mocha';
import { chai } from '../chai';
import { RequestMock } from '../mocks/RequestMock';
import { extractJWT, resolveBasicOptions, tryToLogError } from '../../lib/strategies/commons';
import { LoggerMock } from '../mocks/LoggerMock';

describe('strategies commons functionalities spec', () => {
	const { expect } = chai;
	const token = 'asd54as5d4a86w7ea8c4a5sd';
	const reqMock = new RequestMock();
	const loggerMock = new LoggerMock();

	describe('extractJWT spec', () => {
		const authorization = 'authorization';
		const jwtQueryBodyCookie = 'jwt';

		beforeEach(() => {
			reqMock.reset();
		});

		it('returns when no Jwt present in the request', () => {
			expect(extractJWT({ headers: {} })).to.be.equal(null);
		});

		it('returns null when no Jwt present (No Auth Header)', () => {
			expect(extractJWT(reqMock)).to.be.equal(null);
		});

		it('returns null when malformed Jwt present (Auth Header)', () => {
			reqMock.setHeader(authorization, 'Token');
			expect(extractJWT(reqMock)).to.be.equal(null);
		});

		it('returns null when malformed Jwt present (Auth header does not begin with Token or Bearer)', () => {
			reqMock.setHeader(authorization, 'Tokeen');
			expect(extractJWT(reqMock)).to.be.equal(null);
			reqMock.setHeader(authorization, 'Beaarer');
			expect(extractJWT(reqMock)).to.be.equal(null);
		});

		it('returns null when malformed Jwt present (Auth header does not contain token after Token or Bearer)', () => {
			reqMock.setHeader(authorization, 'Token');
			expect(extractJWT(reqMock)).to.be.equal(null);
			reqMock.setHeader(authorization, 'Bearer');
			expect(extractJWT(reqMock)).to.be.equal(null);
		});

		it('returns token when valid Jwt present (Auth header)', () => {
			reqMock.setHeader(authorization, `Token ${token}`);
			expect(extractJWT(reqMock)).to.be.deep.equal(token);
			reqMock.setHeader(authorization, `Bearer ${token}`);
			expect(extractJWT(reqMock)).to.be.deep.equal(token);
		});

		it('returns token when valid Jwt present (Querry param jwt)', () => {
			reqMock.setQuery(jwtQueryBodyCookie, token);
			expect(extractJWT(reqMock)).to.be.deep.equal(token);
		});

		it('returns token when valid Jwt present (Body jwt)', () => {
			reqMock.setBody(jwtQueryBodyCookie, token);
			expect(extractJWT(reqMock)).to.be.deep.equal(token);
		});

		it('returns token when valid token (Cookies jwt)', () => {
			reqMock.setCookie(jwtQueryBodyCookie, token);
			expect(extractJWT(reqMock)).to.be.deep.equal(token);
		});
	});

	describe('resolveBasicOptions function spec', () => {
		it('returns defaults when no opts provided', () => {
			const opts = resolveBasicOptions();
			expect(opts.verifyOptsProvider).to.be.equal(undefined);
			expect(opts.extractor).to.be.equal(extractJWT);
			expect(opts.attach).to.be.equal('jwtPayload');
		});

		it('returns custom opts when provided', () => {
			const verifyOptsProvider = () => {};
			const extractor = () => {};
			const attach = 'attach';
			const clientOpts = {
				verifyOptsProvider,
				extractor,
				attach
			};
			const opts = resolveBasicOptions(clientOpts);
			expect(opts.verifyOptsProvider).to.be.equal(verifyOptsProvider);
			expect(opts.extractor).to.be.equal(extractor);
			expect(opts.attach).to.be.equal(attach);
		});
	});

	describe('tryToLogError function spec', () => {
		beforeEach(() => {
			loggerMock.reset();
		});

		it('logs when logger is provided', () => {
			const err = new Error();
			const msg = 'My msg';
			tryToLogError(err, msg, loggerMock);
			loggerMock.expect({
				err,
				msg
			});
			/* Should not fails */
			tryToLogError(err, msg);
		});
	});
});

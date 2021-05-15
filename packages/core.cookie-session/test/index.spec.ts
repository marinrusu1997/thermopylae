import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import fetch from 'node-fetch';
import { HttpResponseHeaderEnum, HttpStatusCode } from '@thermopylae/core.declarations';
import { CookieUserSessionMiddleware } from '../lib';
import { routes } from './fixtures/routes';
import { options } from './fixtures/middleware';
import { PORT } from './bootstrap';

const serverAddress = `http://localhost:${PORT}`;

const { CACHE_CONTROL } = HttpResponseHeaderEnum;

describe(`${CookieUserSessionMiddleware.name} spec`, () => {
	describe('session lifetime spec', () => {
		it('authenticates', async () => {
			/* AUTHENTICATE */
			const authResp = await fetch(`${serverAddress}${routes.login.path}`, {
				method: routes.login.method
			});
			expect(authResp.status).to.be.eq(HttpStatusCode.Created);

			expect(authResp.headers.has(options.session.header)).to.be.eq(true); // only set for browsers
			expect(authResp.headers.has(CACHE_CONTROL)).to.be.eq(false); // only set for browsers
		});
	});
});

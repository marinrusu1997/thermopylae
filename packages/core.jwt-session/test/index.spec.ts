import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import { HttpRequestHeaderEnum, HttpResponseHeaderEnum } from '@thermopylae/core.declarations';
import { parse } from 'cookie';
import fetch from 'node-fetch';
import { JwtUserSessionMiddleware } from '../lib';
import { serverAddress } from './bootstrap';
import { options, routes } from './server';

const { AUTHORIZATION, USER_AGENT, COOKIE } = HttpRequestHeaderEnum;
const { SET_COOKIE } = HttpResponseHeaderEnum;

describe(`${JwtUserSessionMiddleware.name} spec`, () => {
	describe('authentication', () => {
		it('authenticates, requests a resource and logs out (mobile device)', async () => {
			/* AUTHENTICATE */
			const authResp = await fetch(`${serverAddress}${routes.login.path}`, {
				method: routes.login.method
			});
			expect(authResp.status).to.be.eq(201);

			const accessToken = authResp.headers.get(options.session.headers.access)!;
			const refreshToken = authResp.headers.get(options.session.headers.refresh)!;

			/* GET RESOURCE */
			const resourceResp = await fetch(`${serverAddress}${routes.get_resource.path}`, {
				method: routes.get_resource.method,
				headers: {
					[AUTHORIZATION]: `Bearer ${accessToken}`
				}
			});
			const resource = await resourceResp.json();

			expect(resourceResp.status).to.be.eq(200);
			expect(resource).to.be.deep.eq({ rest: 'resource', role: 'user' });

			/* LOGOUT */
			const logoutResp = await fetch(`${serverAddress}${routes.logout.path}`, {
				method: routes.logout.method,
				headers: {
					[AUTHORIZATION]: `Bearer ${accessToken}`, // required
					[options.session.headers.refresh]: refreshToken
				}
			});
			expect(logoutResp.status).to.be.eq(200);
		});

		it('authenticates, requests a resource and logs out (browser device & cookies)', async () => {
			/* AUTHENTICATE */
			const authResp = await fetch(`${serverAddress}${routes.login.path}`, {
				method: routes.login.method,
				headers: {
					[USER_AGENT]: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.72 Safari/537.36'
				}
			});
			expect(authResp.status).to.be.eq(201);

			const cookie = authResp.headers
				.raw()
				[SET_COOKIE].map((header) => Object.entries(parse(header)))
				.map((cookies) => `${cookies[0][0]}=${cookies[0][1]}`)
				.join(';');

			/* GET RESOURCE */
			const resourceResp = await fetch(`${serverAddress}${routes.get_resource.path}`, {
				method: routes.get_resource.method,
				headers: {
					[COOKIE]: cookie,
					[options.session.csrfHeader!.name]: options.session.csrfHeader!.value as string
				}
			});
			const resource = await resourceResp.json();

			expect(resourceResp.status).to.be.eq(200);
			expect(resource).to.be.deep.eq({ rest: 'resource', role: 'user' });

			/* LOGOUT */
			const logoutResp = await fetch(`${serverAddress}${routes.logout.path}`, {
				method: routes.logout.method,
				headers: {
					[COOKIE]: cookie,
					[options.session.csrfHeader!.name]: options.session.csrfHeader!.value as string
				}
			});
			expect(logoutResp.status).to.be.eq(200);
		});
	});
});

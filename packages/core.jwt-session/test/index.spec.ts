import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import { HttpRequestHeaderEnum, HttpResponseHeaderEnum, HttpStatusCode, MutableSome } from '@thermopylae/core.declarations';
import { parse } from 'cookie';
import fetch from 'node-fetch';
import { setTimeout } from 'timers/promises';
import { JwtUserSessionMiddleware } from '../lib';
import { serverAddress } from './bootstrap';
import { options, routes } from './server';
import { UserSessionCookiesOptions, UserSessionOptions } from '../lib/middleware';

const { AUTHORIZATION, USER_AGENT, COOKIE, X_FORWARDED_FOR } = HttpRequestHeaderEnum;
const { SET_COOKIE } = HttpResponseHeaderEnum;

// @fixme test scenario when no cookie, no headers, to not crash like a retard

describe(`${JwtUserSessionMiddleware.name} spec`, () => {
	describe('session lifetime spec', () => {
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

		it('authenticates, requests a resource and logs out (browser device & cookies)  (no persistent session cookie)', async () => {
			const { persistent } = options.session.cookies;

			try {
				(options.session.cookies as MutableSome<UserSessionCookiesOptions, 'persistent'>).persistent = false;

				/* AUTHENTICATE */
				const authResp = await fetch(`${serverAddress}${routes.login.path}`, {
					method: routes.login.method,
					headers: {
						[USER_AGENT]: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.72 Safari/537.36'
					}
				});
				expect(authResp.status).to.be.eq(201);

				const accessTokenCookieNames = [options.session.cookies.name.signature, options.session.cookies.name.payload];

				const cookie = authResp.headers
					.raw()
					[SET_COOKIE].map((header) => {
						const parsedCookie = parse(header);
						const cookieName = Object.keys(parsedCookie)[0];

						if (accessTokenCookieNames.includes(cookieName)) {
							expect(parsedCookie['Max-Age']).to.be.eq(undefined, 'Max-Age should not be set');
							expect(parsedCookie.Expires).to.be.eq(undefined, 'Expires should not be set');
						}

						return `${cookieName}=${parsedCookie[cookieName]}`;
					})
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
			} finally {
				(options.session.cookies as MutableSome<UserSessionCookiesOptions, 'persistent'>).persistent = persistent;
			}
		});

		it('authenticates, requests a resource and logs out (browser device & cookie + header)', async () => {
			const { csrfHeader } = options.session;

			try {
				(options.session as MutableSome<UserSessionOptions, 'csrfHeader'>).csrfHeader = undefined;

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
				const accessTokenPayload = authResp.headers.get(options.session.headers.access);

				/* GET RESOURCE */
				const resourceResp = await fetch(`${serverAddress}${routes.get_resource.path}`, {
					method: routes.get_resource.method,
					headers: {
						[COOKIE]: cookie,
						[AUTHORIZATION]: `Bearer ${accessTokenPayload}`
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
						[AUTHORIZATION]: `Bearer ${accessTokenPayload}`
					}
				});
				expect(logoutResp.status).to.be.eq(200);
			} finally {
				(options.session as MutableSome<UserSessionOptions, 'csrfHeader'>).csrfHeader = csrfHeader;
			}
		});
	});

	describe('session validation spec', () => {
		it('requires csrf header when access token is sent via cookies', async () => {
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
				[SET_COOKIE].map((header) => {
					const accessTokenCookie = Object.entries(parse(header))[0];
					return `${accessTokenCookie[0]}=${accessTokenCookie[1]}`;
				})
				.join(';');

			/* GET RESOURCE */
			const resourceResp = await fetch(`${serverAddress}${routes.get_resource.path}`, {
				method: routes.get_resource.method,
				headers: {
					[COOKIE]: cookie
				}
			});
			const validationError = await resourceResp.json();

			expect(resourceResp.status).to.be.eq(HttpStatusCode.Forbidden);
			expect(validationError.message).to.be.eq("CSRF header value 'undefined' differs from the expected one.");
		});

		it("doesn't accept expired access tokens", async () => {
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
				[SET_COOKIE].map((header) => {
					const accessTokenCookie = Object.entries(parse(header))[0];
					return `${accessTokenCookie[0]}=${accessTokenCookie[1]}`;
				})
				.join(';');

			/* GET RESOURCE */
			// w8 access token expiration
			await setTimeout(Number(options.jwt.signOptions.expiresIn) * 1000 + 100);

			const resourceResp = await fetch(`${serverAddress}${routes.get_resource.path}`, {
				method: routes.get_resource.method,
				headers: {
					[COOKIE]: cookie,
					[options.session.csrfHeader!.name]: options.session.csrfHeader!.value as string
				}
			});
			const validationError = await resourceResp.json();

			expect(resourceResp.status).to.be.eq(HttpStatusCode.Forbidden);
			expect(validationError.message).to.be.eq('jwt expired');

			// forced invalidation of access token
			expect(resourceResp.headers.raw()[SET_COOKIE]).to.be.ofSize(2);
			resourceResp.headers.raw()[SET_COOKIE].forEach((header) => {
				const parsedCookie = parse(header);

				if (parsedCookie[options.session.cookies.name.signature] != null) {
					expect(parsedCookie[options.session.cookies.name.signature]).to.be.eq('');
					expect(parsedCookie.Expires).to.be.eq('Thu, 01 Jan 1970 00:00:00 GMT');
				}

				if (parsedCookie[options.session.cookies.name.payload] != null) {
					expect(parsedCookie[options.session.cookies.name.payload]).to.be.eq('');
					expect(parsedCookie.Expires).to.be.eq('Thu, 01 Jan 1970 00:00:00 GMT');
				}
			});
		}).timeout((Number(options.jwt.signOptions.expiresIn) + 1) * 1000);

		it("doesn't accept malformed access tokens", async () => {
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
				[SET_COOKIE].map((header) => {
					const accessTokenCookie = Object.entries(parse(header))[0];
					if (accessTokenCookie[0] === options.session.cookies.name.signature) {
						return `${accessTokenCookie[0]}=invalid-signature`;
					}
					return `${accessTokenCookie[0]}=${accessTokenCookie[1]}`;
				})
				.join(';');

			/* GET RESOURCE */
			const resourceResp = await fetch(`${serverAddress}${routes.get_resource.path}`, {
				method: routes.get_resource.method,
				headers: {
					[COOKIE]: cookie,
					[options.session.csrfHeader!.name]: options.session.csrfHeader!.value as string
				}
			});
			const validationError = await resourceResp.json();

			expect(resourceResp.status).to.be.eq(HttpStatusCode.Forbidden);
			expect(validationError.message).to.be.eq('invalid signature');

			// forced invalidation of access token
			expect(resourceResp.headers.raw()[SET_COOKIE]).to.be.ofSize(2);
			resourceResp.headers.raw()[SET_COOKIE].forEach((header) => {
				const parsedCookie = parse(header);

				if (parsedCookie[options.session.cookies.name.signature] != null) {
					expect(parsedCookie[options.session.cookies.name.signature]).to.be.eq('');
					expect(parsedCookie.Expires).to.be.eq('Thu, 01 Jan 1970 00:00:00 GMT');
				}

				if (parsedCookie[options.session.cookies.name.payload] != null) {
					expect(parsedCookie[options.session.cookies.name.payload]).to.be.eq('');
					expect(parsedCookie.Expires).to.be.eq('Thu, 01 Jan 1970 00:00:00 GMT');
				}
			});
		});

		it("doesn't accept invalidated access tokens", async () => {
			/* AUTHENTICATE */
			const authResp = await fetch(`${serverAddress}${routes.login.path}`, {
				method: routes.login.method,
				headers: {
					[USER_AGENT]: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.72 Safari/537.36'
				}
			});
			expect(authResp.status).to.be.eq(HttpStatusCode.Created);

			const cookie = authResp.headers
				.raw()
				[SET_COOKIE].map((header) => {
					const accessTokenCookie = Object.entries(parse(header))[0];
					return `${accessTokenCookie[0]}=${accessTokenCookie[1]}`;
				})
				.join(';');

			/* INVALIDATE TOKEN */
			const logoutResp = await fetch(`${serverAddress}${routes.logout.path}`, {
				method: routes.logout.method,
				headers: {
					[COOKIE]: cookie,
					[options.session.csrfHeader!.name]: options.session.csrfHeader!.value as string
				}
			});
			expect(logoutResp.status).to.be.eq(200);

			/* READ RESOURCE */
			const resourceResp = await fetch(`${serverAddress}${routes.get_resource.path}`, {
				method: routes.get_resource.method,
				headers: {
					[COOKIE]: cookie,
					[options.session.csrfHeader!.name]: options.session.csrfHeader!.value as string
				}
			});
			const validationError = await resourceResp.json();

			expect(resourceResp.status).to.be.eq(HttpStatusCode.Forbidden);
			expect(validationError.message).to.match(/Token '.+' was forcibly invalidated\./);

			// forced invalidation of access token
			expect(resourceResp.headers.raw()[SET_COOKIE]).to.be.ofSize(2);
			resourceResp.headers.raw()[SET_COOKIE].forEach((header) => {
				const parsedCookie = parse(header);

				if (parsedCookie[options.session.cookies.name.signature] != null) {
					expect(parsedCookie[options.session.cookies.name.signature]).to.be.eq('');
					expect(parsedCookie.Expires).to.be.eq('Thu, 01 Jan 1970 00:00:00 GMT');
				}

				if (parsedCookie[options.session.cookies.name.payload] != null) {
					expect(parsedCookie[options.session.cookies.name.payload]).to.be.eq('');
					expect(parsedCookie.Expires).to.be.eq('Thu, 01 Jan 1970 00:00:00 GMT');
				}
			});

			/* READ ACTIVE SESSIONS AS ADMIN */
			const activeSessionsAdminResp = await fetch(`${serverAddress}${routes.get_active_sessions.path}?uid=uid1`, {
				method: routes.get_active_sessions.method
			});
			const activeSessionsBody = await activeSessionsAdminResp.json();

			expect(activeSessionsBody).to.be.ofSize(0);
		});
	});

	describe('logouts spec', () => {
		it('removes active session from list when it expires', async () => {
			const authResp = await fetch(`${serverAddress}${routes.login.path}`, {
				method: routes.login.method
			});
			expect(authResp.status).to.be.eq(HttpStatusCode.Created);

			/* READ ACTIVE SESSIONS AS ADMIN */
			const activeSessionsAdminResp = await fetch(`${serverAddress}${routes.get_active_sessions.path}?uid=uid1`, {
				method: routes.get_active_sessions.method
			});
			const activeSessionsBody = await activeSessionsAdminResp.json();

			expect(activeSessionsBody).to.be.ofSize(1);
			expect(activeSessionsBody[0].ip).to.be.eq('127.0.0.1');

			/* W8 expiration */
			await setTimeout(options.jwt.invalidationOptions.refreshTokenTtl * 1000 + 100);

			/* READ ACTIVE SESSIONS AGAIN */
			const activeSessionsAdminSecondResp = await fetch(`${serverAddress}${routes.get_active_sessions.path}?uid=uid1`, {
				method: routes.get_active_sessions.method
			});
			const activeSessionsSecondBody = await activeSessionsAdminSecondResp.json();
			expect(activeSessionsSecondBody).to.be.ofSize(0);
		}).timeout(options.jwt.invalidationOptions.refreshTokenTtl * 1000 + 1000);

		it('limits number of concurrent sessions; reads all sessions; deletes all sessions', async () => {
			/* AUTHENTICATE */
			// first session
			const firstAuthResp = await fetch(`${serverAddress}${routes.login.path}`, {
				method: routes.login.method,
				headers: {
					[X_FORWARDED_FOR]: '203.0.113.195, 70.41.3.18, 150.172.238.178'
				}
			});
			expect(firstAuthResp.status).to.be.eq(HttpStatusCode.Created);

			// second session
			const secondAuthResp = await fetch(`${serverAddress}${routes.login.path}`, {
				method: routes.login.method,
				headers: {
					[USER_AGENT]: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.72 Safari/537.36'
				}
			});
			expect(secondAuthResp.status).to.be.eq(HttpStatusCode.Created);

			// third session
			const thirdAuthResp = await fetch(`${serverAddress}${routes.login.path}`, {
				method: routes.login.method
			});
			expect(thirdAuthResp.status).to.be.eq(HttpStatusCode.BadRequest);

			const thirdAuthRespErr = await thirdAuthResp.json();
			expect(thirdAuthRespErr.message).to.be.eq("Concurrent user sessions limit reached for subject 'uid1', as he has 2 active sessions.");

			/* READ ACTIVE SESSIONS */
			const firstAccessToken = firstAuthResp.headers.get(options.session.headers.access)!;

			const activeSessionsResp = await fetch(`${serverAddress}${routes.get_active_sessions.path}`, {
				method: routes.get_active_sessions.method,
				headers: {
					[AUTHORIZATION]: `Bearer ${firstAccessToken}`
				}
			});
			const activeSessions = await activeSessionsResp.json();

			expect(activeSessions).to.be.ofSize(2);

			expect(activeSessions[0].ip).to.be.eq('127.0.0.1');
			expect(activeSessions[0].device).to.be.deep.eq({
				name: ' ',
				type: 'desktop',
				client: { type: 'browser', name: 'Chrome', version: '89.0', engine: 'Blink', engineVersion: '' },
				os: { name: 'GNU/Linux', version: '', platform: 'x64' }
			});
			expect(activeSessions[0].location).to.be.deep.eq({
				countryCode: 'RO',
				regionCode: 'B',
				city: 'Bucharest',
				latitude: 15.6,
				longitude: 18.6,
				timezone: 'Bucharest +2'
			});
			expect(activeSessions[0].expiresAt).to.be.greaterThan(activeSessions[0].createdAt);

			expect(activeSessions[1].ip).to.be.eq('203.0.113.195');
			expect(activeSessions[1].device).to.be.eq(undefined);
			expect(activeSessions[1].location).to.be.deep.eq({
				countryCode: 'RO',
				regionCode: 'B',
				city: 'Bucharest',
				latitude: 15.6,
				longitude: 18.6,
				timezone: 'Bucharest +2'
			});
			expect(activeSessions[1].expiresAt).to.be.greaterThan(activeSessions[1].createdAt);

			/* DELETE ACTIVE SESSIONS */
			const logoutAllResponse = await fetch(`${serverAddress}${routes.logout_from_all_sessions.path}`, {
				method: routes.logout_from_all_sessions.method,
				headers: {
					[AUTHORIZATION]: `Bearer ${firstAccessToken}`,
					[options.session.headers.refresh]: firstAuthResp.headers.get(options.session.headers.refresh)!
				}
			});
			const logoutResponse = await logoutAllResponse.json();
			expect(logoutResponse).to.be.deep.eq({ sessions: 2 });

			/* Ensure access tokens are no longer valid */
			// first
			const firstResourceResp = await fetch(`${serverAddress}${routes.get_resource.path}`, {
				method: routes.get_resource.method,
				headers: {
					[AUTHORIZATION]: `Bearer ${firstAccessToken}`,
					[options.session.headers.refresh]: firstAuthResp.headers.get(options.session.headers.refresh)!
				}
			});
			const firstValidationError = await firstResourceResp.json();

			expect(firstResourceResp.status).to.be.eq(HttpStatusCode.Forbidden);
			expect(firstValidationError.message).to.match(/Token '.+' was forcibly invalidated\./);

			// second
			const secondSessionCookie = secondAuthResp.headers
				.raw()
				[SET_COOKIE].map((header) => {
					const accessTokenCookie = Object.entries(parse(header))[0];
					return `${accessTokenCookie[0]}=${accessTokenCookie[1]}`;
				})
				.join(';');

			const secondResourceResp = await fetch(`${serverAddress}${routes.get_resource.path}`, {
				method: routes.get_resource.method,
				headers: {
					[COOKIE]: secondSessionCookie,
					[options.session.csrfHeader!.name]: options.session.csrfHeader!.value as string
				}
			});
			const secondValidationError = await secondResourceResp.json();

			expect(secondResourceResp.status).to.be.eq(HttpStatusCode.Forbidden);
			expect(secondValidationError.message).to.match(/Token '.+' was forcibly invalidated\./);

			/* READ ACTIVE SESSIONS AS ADMIN */
			const activeSessionsAdminResp = await fetch(`${serverAddress}${routes.get_active_sessions.path}?uid=uid1`, {
				method: routes.get_active_sessions.method
			});
			const activeSessionsBody = await activeSessionsAdminResp.json();
			expect(activeSessionsBody).to.be.ofSize(0);
		});
	});
});

import { HttpRequestHeaderEnum, HttpResponseHeaderEnum, HttpStatusCode, type ObjMap } from '@thermopylae/core.declarations';
import type { MutableSome, Seconds } from '@thermopylae/core.declarations';
import { JwtUserSessionManagerEvent } from '@thermopylae/lib.jwt-user-session';
import type { IssuedJwtPayload } from '@thermopylae/lib.jwt-user-session';
import capitalize from 'capitalize';
import { parse, serialize } from 'cookie';
import fetch from 'node-fetch';
import { setTimeout } from 'timers/promises';
import { describe, expect, it } from 'vitest';
import { JwtUserSessionMiddleware } from '../lib/index.js';
import type { UserSessionCookiesOptions, UserSessionOptions } from '../lib/index.js';
import { serverAddress } from './bootstrap.js';
import { middleware, options, routes } from './server.js';

const { AUTHORIZATION, USER_AGENT, COOKIE, X_FORWARDED_FOR } = HttpRequestHeaderEnum;
const { SET_COOKIE, CACHE_CONTROL } = HttpResponseHeaderEnum;

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
			expect(authResp.headers.has(CACHE_CONTROL)).to.be.eq(false); // only set for browsers

			/* GET RESOURCE */
			const resourceResp = await fetch(`${serverAddress}${routes.get_resource.path}`, {
				method: routes.get_resource.method,
				headers: {
					[AUTHORIZATION]: `Bearer ${accessToken}`
				}
			});
			const resource = (await resourceResp.json()) as ObjMap;

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
			const { persistentAccessToken } = options.session.cookies;

			try {
				(options.session.cookies as MutableSome<UserSessionCookiesOptions, 'persistentAccessToken'>).persistentAccessToken = false;

				/* AUTHENTICATE */
				const authResp = await fetch(`${serverAddress}${routes.login.path}`, {
					method: routes.login.method,
					headers: {
						[USER_AGENT]: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.72 Safari/537.36'
					}
				});
				expect(authResp.status).to.be.eq(201);
				expect(authResp.headers.get(CACHE_CONTROL)).to.be.eq('no-cache="set-cookie, set-cookie2"'); // only set-cookie headers were used

				const accessTokenCookieNames = [options.session.cookies.name.signature, options.session.cookies.name.payload];

				const cookie = authResp.headers
					.raw()
					[SET_COOKIE].map((header) => {
						const parsedCookie = parse(header);
						const cookieName = Object.keys(parsedCookie)[0];

						if (accessTokenCookieNames.includes(cookieName)) {
							expect(parsedCookie['Max-Age']).to.be.eq(undefined, 'Max-Age should not be set');
							expect(parsedCookie['Expires']).to.be.eq(undefined, 'Expires should not be set');
						}

						return `${cookieName}=${parsedCookie[cookieName]}`;
					})
					.join(';');

				/* GET RESOURCE */
				const resourceResp = await fetch(`${serverAddress}${routes.get_resource.path}`, {
					method: routes.get_resource.method,
					headers: {
						[COOKIE]: cookie,
						[options.session.csrfHeader.name]: options.session.csrfHeader.value as string
					}
				});
				const resource = (await resourceResp.json()) as ObjMap;

				expect(resourceResp.status).to.be.eq(200);
				expect(resource).to.be.deep.eq({ rest: 'resource', role: 'user' });

				/* LOGOUT */
				const logoutResp = await fetch(`${serverAddress}${routes.logout.path}`, {
					method: routes.logout.method,
					headers: {
						[COOKIE]: cookie,
						[options.session.csrfHeader.name]: options.session.csrfHeader.value as string
					}
				});
				expect(logoutResp.status).to.be.eq(200);
			} finally {
				(options.session.cookies as MutableSome<UserSessionCookiesOptions, 'persistentAccessToken'>).persistentAccessToken = persistentAccessToken;
			}
		});

		it('authenticates, requests a resource and logs out (browser device & cookie + header)', async () => {
			const { deliveryOfJwtPayloadViaCookie } = options.session;

			try {
				(options.session as MutableSome<UserSessionOptions, 'deliveryOfJwtPayloadViaCookie'>).deliveryOfJwtPayloadViaCookie = false;

				/* AUTHENTICATE */
				const authResp = await fetch(`${serverAddress}${routes.login.path}`, {
					method: routes.login.method,
					headers: {
						[USER_AGENT]: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.72 Safari/537.36'
					}
				});
				expect(authResp.status).to.be.eq(HttpStatusCode.Created);
				expect(authResp.headers.get(CACHE_CONTROL)).to.be.eq(`no-cache="set-cookie, set-cookie2, ${options.session.headers.access}"`);

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
				const resource = (await resourceResp.json()) as ObjMap;

				expect(resourceResp.status).to.be.eq(200);
				expect(resource).to.be.deep.eq({ rest: 'resource', role: 'user' });

				/* LOGOUT */
				const logoutResp = await fetch(`${serverAddress}${routes.logout.path}`, {
					method: routes.logout.method,
					headers: {
						[COOKIE]: cookie,
						[AUTHORIZATION]: `Bearer ${accessTokenPayload}`,
						[options.session.csrfHeader.name]: options.session.csrfHeader.value as string
					}
				});
				expect(logoutResp.status).to.be.eq(HttpStatusCode.Ok);
			} finally {
				(options.session as MutableSome<UserSessionOptions, 'deliveryOfJwtPayloadViaCookie'>).deliveryOfJwtPayloadViaCookie =
					deliveryOfJwtPayloadViaCookie;
			}
		});
	});

	describe('session creation spec', () => {
		it('creates multiple sessions for browser with accordingly serialized signature and payload cookies', async () => {
			/* AUTHENTICATE (first session) */
			const firstAuthResp = await fetch(`${serverAddress}${routes.login.path}`, {
				method: routes.login.method,
				headers: {
					[USER_AGENT]: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.72 Safari/537.36'
				}
			});
			expect(firstAuthResp.status).to.be.eq(HttpStatusCode.Created);

			const firstAccessTokenCookies = firstAuthResp.headers
				.get(SET_COOKIE)!
				.split(', ')
				.filter((cookie) => !cookie.startsWith(options.session.cookies.name.refresh));
			expect(firstAccessTokenCookies).to.have.length(2);
			for (const cookie of firstAccessTokenCookies) {
				if (cookie.startsWith(options.session.cookies.name.signature)) {
					expect(cookie).to.match(
						new RegExp(
							`${options.session.cookies.name.signature}=.+; Max-Age=${options.jwt.signOptions.expiresIn}; Path=${
								options.session.cookies.path['access-signature']
							}; HttpOnly; Secure; SameSite=${capitalize(options.session.cookies.sameSite as string)}`
						)
					);
				}
				if (cookie.startsWith(options.session.cookies.name.payload)) {
					expect(cookie).to.match(
						new RegExp(
							`${options.session.cookies.name.payload}=.+; Max-Age=${options.jwt.signOptions.expiresIn}; Path=${
								options.session.cookies.path['access-payload']
							}; Secure; SameSite=${capitalize(options.session.cookies.sameSite as string)}`
						)
					);
				}
			}

			/* AUTHENTICATE (second session) */
			const secondAuthResp = await fetch(`${serverAddress}${routes.login.path}`, {
				method: routes.login.method,
				headers: {
					[USER_AGENT]: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.72 Safari/537.36'
				}
			});
			expect(secondAuthResp.status).to.be.eq(HttpStatusCode.Created);

			const secondAccessTokenCookies = secondAuthResp.headers
				.get(SET_COOKIE)!
				.split(', ')
				.filter((cookie) => !cookie.startsWith(options.session.cookies.name.refresh));
			expect(secondAccessTokenCookies).to.have.length(2);
			for (const cookie of secondAccessTokenCookies) {
				if (cookie.startsWith(options.session.cookies.name.signature)) {
					expect(cookie).to.match(
						new RegExp(
							`${options.session.cookies.name.signature}=.+; Max-Age=${options.jwt.signOptions.expiresIn}; Path=${
								options.session.cookies.path['access-signature']
							}; HttpOnly; Secure; SameSite=${capitalize(options.session.cookies.sameSite as string)}`
						)
					);
				}
				if (cookie.startsWith(options.session.cookies.name.payload)) {
					expect(cookie).to.match(
						new RegExp(
							`${options.session.cookies.name.payload}=.+; Max-Age=${options.jwt.signOptions.expiresIn}; Path=${
								options.session.cookies.path['access-payload']
							}; Secure; SameSite=${capitalize(options.session.cookies.sameSite as string)}`
						)
					);
				}
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
			expect(authResp.status).to.be.eq(HttpStatusCode.Created);

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
			const validationError = (await resourceResp.json()) as ObjMap;

			expect(resourceResp.status).to.be.eq(HttpStatusCode.Forbidden);
			expect(validationError.message).to.be.eq("CSRF header value 'undefined' differs from the expected one.");
		});

		it("doesn't accept expired access tokens", { timeout: (Number(options.jwt.signOptions.expiresIn) + 1) * 1000 }, async () => {
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
			await setTimeout(Number(options.jwt.signOptions.expiresIn) * 1000 + 100, { ref: true });

			const resourceResp = await fetch(`${serverAddress}${routes.get_resource.path}`, {
				method: routes.get_resource.method,
				headers: {
					[COOKIE]: cookie,
					[options.session.csrfHeader.name]: options.session.csrfHeader.value as string
				}
			});
			const validationError = (await resourceResp.json()) as ObjMap;

			expect(resourceResp.status).to.be.eq(HttpStatusCode.Forbidden);
			expect(validationError.message).to.be.eq('jwt expired');

			// forced invalidation of access token
			expect(resourceResp.headers.raw()[SET_COOKIE]).to.have.length(2);
			resourceResp.headers.raw()[SET_COOKIE].forEach((header) => {
				const parsedCookie = parse(header);

				if (parsedCookie[options.session.cookies.name.signature] != null) {
					expect(parsedCookie[options.session.cookies.name.signature]).to.be.eq('');
					expect(parsedCookie['Expires']).to.be.eq('Thu, 01 Jan 1970 00:00:00 GMT');
				}

				if (parsedCookie[options.session.cookies.name.payload] != null) {
					expect(parsedCookie[options.session.cookies.name.payload]).to.be.eq('');
					expect(parsedCookie['Expires']).to.be.eq('Thu, 01 Jan 1970 00:00:00 GMT');
				}
			});
		});

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
					[options.session.csrfHeader.name]: options.session.csrfHeader.value as string
				}
			});
			const validationError = (await resourceResp.json()) as ObjMap;

			expect(resourceResp.status).to.be.eq(HttpStatusCode.Forbidden);
			expect(validationError.message).to.be.eq('invalid signature');

			// forced invalidation of access token
			expect(resourceResp.headers.raw()[SET_COOKIE]).to.have.length(2);
			resourceResp.headers.raw()[SET_COOKIE].forEach((header) => {
				const parsedCookie = parse(header);

				if (parsedCookie[options.session.cookies.name.signature] != null) {
					expect(parsedCookie[options.session.cookies.name.signature]).to.be.eq('');
					expect(parsedCookie['Expires']).to.be.eq('Thu, 01 Jan 1970 00:00:00 GMT');
				}

				if (parsedCookie[options.session.cookies.name.payload] != null) {
					expect(parsedCookie[options.session.cookies.name.payload]).to.be.eq('');
					expect(parsedCookie['Expires']).to.be.eq('Thu, 01 Jan 1970 00:00:00 GMT');
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
					[options.session.csrfHeader.name]: options.session.csrfHeader.value as string
				}
			});
			expect(logoutResp.status).to.be.eq(200);

			/* READ RESOURCE */
			const resourceResp = await fetch(`${serverAddress}${routes.get_resource.path}`, {
				method: routes.get_resource.method,
				headers: {
					[COOKIE]: cookie,
					[options.session.csrfHeader.name]: options.session.csrfHeader.value as string
				}
			});
			const validationError = (await resourceResp.json()) as ObjMap;

			expect(resourceResp.status).to.be.eq(HttpStatusCode.Forbidden);
			expect(validationError.message).to.match(/Token '.+' was forcibly invalidated\./);

			// forced invalidation of access token
			expect(resourceResp.headers.raw()[SET_COOKIE]).to.have.length(2);
			resourceResp.headers.raw()[SET_COOKIE].forEach((header) => {
				const parsedCookie = parse(header);

				if (parsedCookie[options.session.cookies.name.signature] != null) {
					expect(parsedCookie[options.session.cookies.name.signature]).to.be.eq('');
					expect(parsedCookie['Expires']).to.be.eq('Thu, 01 Jan 1970 00:00:00 GMT');
				}

				if (parsedCookie[options.session.cookies.name.payload] != null) {
					expect(parsedCookie[options.session.cookies.name.payload]).to.be.eq('');
					expect(parsedCookie['Expires']).to.be.eq('Thu, 01 Jan 1970 00:00:00 GMT');
				}
			});

			/* READ ACTIVE SESSIONS AS ADMIN */
			const activeSessionsAdminResp = await fetch(`${serverAddress}${routes.get_active_sessions.path}?uid=uid1`, {
				method: routes.get_active_sessions.method
			});
			const activeSessionsBody = (await activeSessionsAdminResp.json()) as ObjMap;

			expect(Object.keys(activeSessionsBody)).to.have.length(0);
		});
	});

	describe('logouts spec', () => {
		describe('admin forced logouts', () => {
			it('logouts from existing session', async () => {
				/* CREATE SESSION */
				const authResp = await fetch(`${serverAddress}${routes.login.path}`, {
					method: routes.login.method
				});
				expect(authResp.status).to.be.eq(HttpStatusCode.Created);

				const refreshToken = authResp.headers.get(options.session.headers.refresh)!;
				const activeSessions = await middleware.sessionManager.readAll('uid1');
				expect(Array.from(activeSessions.keys())).toStrictEqual([refreshToken]);

				/* DELETE SESSION */
				let eventArgs: IssuedJwtPayload | undefined;
				function listener(jwtPayload: IssuedJwtPayload): void {
					eventArgs = jwtPayload;
				}

				middleware.sessionManager.on(JwtUserSessionManagerEvent.SESSION_INVALIDATED, listener);

				try {
					const logoutResponse = await fetch(`${serverAddress}${routes.logout.path}?uid=uid1`, {
						method: routes.logout.method,
						headers: {
							[COOKIE]: serialize(options.session.cookies.name.refresh, refreshToken),
							[options.session.csrfHeader.name]: options.session.csrfHeader.value as string
						}
					});

					expect(logoutResponse.status).to.be.eq(HttpStatusCode.Ok);
					expect(logoutResponse.headers.get(SET_COOKIE)).to.be.eq(null);

					expect(eventArgs).to.be.eq(undefined); // no event emitted

					expect((await middleware.sessionManager.readAll('uid1')).size).to.be.eq(0);
				} finally {
					middleware.sessionManager.off(JwtUserSessionManagerEvent.ALL_SESSIONS_INVALIDATED, listener);
				}
			});

			it('logouts from non-existing session', async () => {
				let eventArgs: IssuedJwtPayload | undefined;
				function listener(jwtPayload: IssuedJwtPayload): void {
					eventArgs = jwtPayload;
				}

				middleware.sessionManager.on(JwtUserSessionManagerEvent.SESSION_INVALIDATED, listener);

				try {
					const logoutResponse = await fetch(`${serverAddress}${routes.logout.path}?uid=uid1`, {
						method: routes.logout.method,
						headers: {
							[COOKIE]: serialize(options.session.cookies.name.refresh, 'invalid-refresh-token'),
							[options.session.csrfHeader.name]: options.session.csrfHeader.value as string
						}
					});

					expect(logoutResponse.status).to.be.eq(HttpStatusCode.Ok);
					expect(logoutResponse.headers.get(SET_COOKIE)).to.be.eq(null);

					expect(eventArgs).to.be.eq(undefined); // no event emitted
				} finally {
					middleware.sessionManager.off(JwtUserSessionManagerEvent.ALL_SESSIONS_INVALIDATED, listener);
				}
			});

			it('logouts from all sessions (user have no sessions)', async () => {
				let eventArgs: [string, Seconds] | undefined;
				function listener(subject: string, accessTokenTtl: Seconds): void {
					eventArgs = [subject, accessTokenTtl];
				}

				middleware.sessionManager.on(JwtUserSessionManagerEvent.ALL_SESSIONS_INVALIDATED, listener);

				try {
					const logoutAllResponse = await fetch(`${serverAddress}${routes.logout_from_all_sessions.path}?uid=uid1`, {
						method: routes.logout_from_all_sessions.method
					});
					const logoutResponse = (await logoutAllResponse.json()) as ObjMap;
					expect(logoutResponse).to.be.deep.eq({ sessions: 0 });

					expect(eventArgs).toStrictEqual(['uid1', options.jwt.signOptions.expiresIn]); // event emitted
				} finally {
					middleware.sessionManager.off(JwtUserSessionManagerEvent.ALL_SESSIONS_INVALIDATED, listener);
				}
			});

			it('logouts from all sessions multiple times consecutive (user has 1 session)', async () => {
				/* CREATE SESSION */
				const authResp = await fetch(`${serverAddress}${routes.login.path}`, {
					method: routes.login.method
				});
				expect(authResp.status).to.be.eq(HttpStatusCode.Created);

				/* DELETE ALL SESSION */
				let eventArgs: [string, Seconds] | undefined;
				function listener(subject: string, accessTokenTtl: Seconds): void {
					eventArgs = [subject, accessTokenTtl];
				}

				middleware.sessionManager.on(JwtUserSessionManagerEvent.ALL_SESSIONS_INVALIDATED, listener);

				try {
					const logoutAllResponse = await fetch(`${serverAddress}${routes.logout_from_all_sessions.path}?uid=uid1`, {
						method: routes.logout_from_all_sessions.method
					});
					const logoutResponse = (await logoutAllResponse.json()) as ObjMap;
					expect(logoutResponse).to.be.deep.eq({ sessions: 1 });

					expect(eventArgs).toStrictEqual(['uid1', options.jwt.signOptions.expiresIn]); // event emitted
				} finally {
					middleware.sessionManager.off(JwtUserSessionManagerEvent.ALL_SESSIONS_INVALIDATED, listener);
				}

				/* DELETE ALL SESSIONS CONSECUTIVE */
				const logoutAllResponse = await fetch(`${serverAddress}${routes.logout_from_all_sessions.path}?uid=uid1`, {
					method: routes.logout_from_all_sessions.method
				});
				const logoutResponse = (await logoutAllResponse.json()) as ObjMap;
				expect(logoutResponse).to.be.deep.eq({ sessions: 0 });

				/* READ ACTIVE SESSIONS AS ADMIN */
				const activeSessionsAdminResp = await fetch(`${serverAddress}${routes.get_active_sessions.path}?uid=uid1`, {
					method: routes.get_active_sessions.method
				});
				const activeSessionsBody = (await activeSessionsAdminResp.json()) as ObjMap;
				expect(Object.keys(activeSessionsBody)).to.have.length(0);
			});
		});

		it('removes active session from list when it expires', { timeout: options.jwt.invalidationOptions.refreshTokenTtl * 1000 + 1000 }, async () => {
			/* CREATE SESSION */
			const authResp = await fetch(`${serverAddress}${routes.login.path}`, {
				method: routes.login.method
			});
			expect(authResp.status).to.be.eq(HttpStatusCode.Created);

			/* READ ACTIVE SESSIONS AS ADMIN */
			const activeSessionsAdminResp = await fetch(`${serverAddress}${routes.get_active_sessions.path}?uid=uid1`, {
				method: routes.get_active_sessions.method
			});
			const activeSessionsBody = (await activeSessionsAdminResp.json()) as ObjMap;

			expect(Object.keys(activeSessionsBody)).to.have.length(1);

			const refreshToken = authResp.headers.get(options.session.headers.refresh)!;
			expect(activeSessionsBody[refreshToken].ip).to.be.oneOf(['::1', '127.0.0.1']);

			/* W8 expiration */
			await setTimeout(options.jwt.invalidationOptions.refreshTokenTtl * 1000 + 100, { ref: true });

			/* READ ACTIVE SESSIONS AGAIN */
			const activeSessionsAdminSecondResp = await fetch(`${serverAddress}${routes.get_active_sessions.path}?uid=uid1`, {
				method: routes.get_active_sessions.method
			});
			const activeSessionsSecondBody = (await activeSessionsAdminSecondResp.json()) as ObjMap;
			expect(Object.keys(activeSessionsSecondBody)).to.have.length(0);
		});

		it('limits number of concurrent sessions; reads all sessions; deletes all sessions', async () => {
			/* AUTHENTICATE */
			// first session
			const firstAuthResp = await fetch(`${serverAddress}${routes.login.path}?location=1`, {
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

			const thirdAuthRespErr = (await thirdAuthResp.json()) as ObjMap;
			expect(thirdAuthRespErr.message).to.be.eq("Concurrent user sessions limit reached for subject 'uid1', as he has 2 active sessions.");

			/* READ ACTIVE SESSIONS */
			const firstAccessToken = firstAuthResp.headers.get(options.session.headers.access)!;
			const firstRefreshToken = firstAuthResp.headers.get(options.session.headers.refresh)!;

			const activeSessionsResp = await fetch(`${serverAddress}${routes.get_active_sessions.path}`, {
				method: routes.get_active_sessions.method,
				headers: {
					[AUTHORIZATION]: `Bearer ${firstAccessToken}`
				}
			});
			const activeSessions = (await activeSessionsResp.json()) as ObjMap;

			expect(Object.keys(activeSessions)).to.have.length(2);

			const [, secondRefreshToken] = secondAuthResp.headers
				.raw()
				[SET_COOKIE].map((header) => {
					const parsedCookie = parse(header);
					const cookieName = Object.keys(parsedCookie)[0];
					return [cookieName, parsedCookie[cookieName]];
				})
				.find(([name]) => {
					return name === options.session.cookies.name.refresh;
				}) as [string, string];

			expect(activeSessions[secondRefreshToken].ip).to.be.oneOf(['::1', '127.0.0.1']);
			expect(activeSessions[secondRefreshToken].device.name).to.be.eq(' ');
			expect(activeSessions[secondRefreshToken].device.type).to.be.eq('desktop');
			expect(activeSessions[secondRefreshToken].device.client.type).to.be.eq('browser');
			expect(activeSessions[secondRefreshToken].device.client.name).to.be.eq('Chrome');
			expect(activeSessions[secondRefreshToken].device.client.version).to.be.eq('89.0');
			expect(activeSessions[secondRefreshToken].device.os).to.be.deep.eq({
				name: 'GNU/Linux',
				version: '',
				platform: 'x64'
			});
			expect(activeSessions[secondRefreshToken].location).to.be.deep.eq(null);
			expect(activeSessions[secondRefreshToken].expiresAt).to.be.greaterThan(activeSessions[secondRefreshToken].createdAt);

			expect(activeSessions[firstRefreshToken].ip).to.be.eq('203.0.113.195');
			expect(activeSessions[firstRefreshToken].device).to.be.eq(null);
			expect(activeSessions[firstRefreshToken].location.countryCode).to.be.eq('RO');
			expect(activeSessions[firstRefreshToken].location.regionCode).to.be.eq(null);
			expect(activeSessions[firstRefreshToken].location.city).to.be.eq('Bucharest');
			expect(Math.trunc(activeSessions[firstRefreshToken].location.latitude)).to.be.eq(15); // floating point precision issues
			expect(activeSessions[firstRefreshToken].location.longitude).to.be.eq(null);
			expect(activeSessions[firstRefreshToken].location.timezone).to.be.eq(null);
			expect(activeSessions[firstRefreshToken].expiresAt).to.be.greaterThan(activeSessions[firstRefreshToken].createdAt);

			/* DELETE ALL ACTIVE SESSIONS */
			const logoutAllResponse = await fetch(`${serverAddress}${routes.logout_from_all_sessions.path}`, {
				method: routes.logout_from_all_sessions.method,
				headers: {
					[AUTHORIZATION]: `Bearer ${firstAccessToken}`,
					[options.session.headers.refresh]: firstRefreshToken
				}
			});
			const logoutResponse = (await logoutAllResponse.json()) as ObjMap;
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
			const firstValidationError = (await firstResourceResp.json()) as ObjMap;

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
					[options.session.csrfHeader.name]: options.session.csrfHeader.value as string
				}
			});
			const secondValidationError = (await secondResourceResp.json()) as ObjMap;

			expect(secondResourceResp.status).to.be.eq(HttpStatusCode.Forbidden);
			expect(secondValidationError.message).to.match(/Token '.+' was forcibly invalidated\./);

			/* READ ACTIVE SESSIONS AS ADMIN */
			const activeSessionsAdminResp = await fetch(`${serverAddress}${routes.get_active_sessions.path}?uid=uid1`, {
				method: routes.get_active_sessions.method
			});
			const activeSessionsBody = (await activeSessionsAdminResp.json()) as ObjMap;
			expect(Object.keys(activeSessionsBody)).to.have.length(0);
		});

		it('invalidates all cookies on logout', async () => {
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
					const parsedCookie = parse(header);
					const cookieName = Object.keys(parsedCookie)[0];
					return `${cookieName}=${parsedCookie[cookieName]}`;
				})
				.join(';');

			/* LOGOUT */
			const logoutResponse = await fetch(`${serverAddress}${routes.logout.path}?unset-cookies=1`, {
				method: routes.logout.method,
				headers: {
					[COOKIE]: cookie,
					[options.session.csrfHeader.name]: options.session.csrfHeader.value as string
				}
			});
			expect(logoutResponse.status).to.be.eq(200);

			let validatedHeaders = 0;
			logoutResponse.headers.raw()[SET_COOKIE].forEach((header) => {
				if (header.startsWith(options.session.cookies.name.refresh)) {
					expect(header).to.be.eq(
						`${options.session.cookies.name.refresh}=; Path=${
							options.session.cookies.path.refresh
						}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=${capitalize(options.session.cookies.sameSite as string)}`
					);
					validatedHeaders += 1;
					return;
				}

				if (header.startsWith(options.session.cookies.name.signature)) {
					expect(header).to.be.eq(
						`${options.session.cookies.name.signature}=; Path=${
							options.session.cookies.path['access-signature']
						}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=${capitalize(options.session.cookies.sameSite as string)}`
					);
					validatedHeaders += 1;
					return;
				}

				if (header.startsWith(options.session.cookies.name.payload)) {
					expect(header).to.be.eq(
						`${options.session.cookies.name.payload}=; Path=${
							options.session.cookies.path['access-payload']
						}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=${capitalize(options.session.cookies.sameSite as string)}`
					);
					validatedHeaders += 1;
				}
			});
			expect(validatedHeaders).to.be.eq(3);
		});
	});

	describe('renew spec', () => {
		it('renews access token for browser devices', async () => {
			/* CREATE SESSION */
			const authResp = await fetch(`${serverAddress}${routes.login.path}`, {
				method: routes.login.method,
				headers: {
					[USER_AGENT]: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.72 Safari/537.36'
				}
			});
			expect(authResp.status).to.be.eq(HttpStatusCode.Created);

			const refreshTokenCookie = authResp.headers
				.raw()
				[SET_COOKIE].map((header) => {
					const parsedCookie = parse(header);
					const cookieName = Object.keys(parsedCookie)[0];
					return [cookieName, parsedCookie[cookieName]];
				})
				.find(([name]) => {
					return name === options.session.cookies.name.refresh;
				})!
				.join('=');

			/* RENEW SESSION */
			const renewResp = await fetch(`${serverAddress}${routes.renew_session.path}?uid=uid1`, {
				method: routes.renew_session.method,
				headers: {
					[COOKIE]: refreshTokenCookie,
					[options.session.csrfHeader.name]: options.session.csrfHeader.value as string,
					[USER_AGENT]: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.72 Safari/537.36'
				}
			});
			expect(renewResp.status).to.be.eq(HttpStatusCode.Ok);
			expect(renewResp.headers.get(CACHE_CONTROL)).to.be.eq('no-cache="set-cookie, set-cookie2"');

			const cookie = renewResp.headers
				.raw()
				[SET_COOKIE].map((header) => Object.entries(parse(header)))
				.map((cookies) => `${cookies[0][0]}=${cookies[0][1]}`)
				.join(';');

			/* GET RESOURCE */
			const resourceResp = await fetch(`${serverAddress}${routes.get_resource.path}`, {
				method: routes.get_resource.method,
				headers: {
					[COOKIE]: cookie,
					[options.session.csrfHeader.name]: options.session.csrfHeader.value as string
				}
			});
			const resource = (await resourceResp.json()) as ObjMap;

			expect(resourceResp.status).to.be.eq(HttpStatusCode.Ok);
			expect(resource).to.be.deep.eq({ rest: 'resource', role: 'user' });
		});

		it('renews access token for mobile devices', async () => {
			/* CREATE SESSION */
			const authResp = await fetch(`${serverAddress}${routes.login.path}`, {
				method: routes.login.method
			});
			expect(authResp.status).to.be.eq(HttpStatusCode.Created);

			const refreshToken = authResp.headers.get(options.session.headers.refresh) as string;

			/* RENEW SESSION */
			const renewResp = await fetch(`${serverAddress}${routes.renew_session.path}?uid=uid1`, {
				method: routes.renew_session.method,
				headers: {
					[options.session.headers.refresh]: refreshToken
				}
			});
			expect(renewResp.status).to.be.eq(HttpStatusCode.Ok);
			expect(renewResp.headers.has(CACHE_CONTROL)).to.be.eq(false); // for mobile is no needed

			const accessToken = renewResp.headers.get(options.session.headers.access) as string;

			/* GET RESOURCE */
			const resourceResp = await fetch(`${serverAddress}${routes.get_resource.path}`, {
				method: routes.get_resource.method,
				headers: {
					[AUTHORIZATION]: `Bearer ${accessToken}`
				}
			});
			const resource = (await resourceResp.json()) as ObjMap;

			expect(resourceResp.status).to.be.eq(HttpStatusCode.Ok);
			expect(resource).to.be.deep.eq({ rest: 'resource', role: 'user' });
		});

		it('fails to renew access token if refresh token is expired', { timeout: options.jwt.invalidationOptions.refreshTokenTtl * 1000 + 500 }, async () => {
			/* CREATE SESSION */
			const authResp = await fetch(`${serverAddress}${routes.login.path}`, {
				method: routes.login.method
			});
			expect(authResp.status).to.be.eq(HttpStatusCode.Created);

			const refreshToken = authResp.headers.get(options.session.headers.refresh) as string;

			/* W8 for refresh token expiration */
			await setTimeout(options.jwt.invalidationOptions.refreshTokenTtl * 1000 + 100, { ref: true });

			/* RENEW SESSION */
			const renewResp = await fetch(`${serverAddress}${routes.renew_session.path}?uid=uid1`, {
				method: routes.renew_session.method,
				headers: {
					[options.session.headers.refresh]: refreshToken
				}
			});
			expect(renewResp.status).to.be.eq(HttpStatusCode.NotFound);
		});

		it('fails to renew access token if refresh token is not given', async () => {
			/* CREATE SESSION */
			const authResp = await fetch(`${serverAddress}${routes.login.path}`, {
				method: routes.login.method
			});
			expect(authResp.status).to.be.eq(HttpStatusCode.Created);

			/* RENEW SESSION */
			const renewResp = await fetch(`${serverAddress}${routes.renew_session.path}?uid=uid1`, {
				method: routes.renew_session.method
			});
			expect(renewResp.status).to.be.eq(HttpStatusCode.NotFound);
		});
	});
});

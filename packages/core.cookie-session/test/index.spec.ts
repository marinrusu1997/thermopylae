import { HttpRequestHeaderEnum, HttpResponseHeaderEnum, HttpStatusCode } from '@thermopylae/core.declarations';
import type { HTTPRequestLocation, MutableSome } from '@thermopylae/core.declarations';
import type { UserSessionDevice } from '@thermopylae/core.user-session.commons';
import { AVRO_SERIALIZER } from '@thermopylae/core.user-session.commons/dist/storage/serializers/cookie/avro.js';
import type { UserSessionMetaData, UserSessionTimeouts } from '@thermopylae/lib.user-session';
import capitalize from 'capitalize';
import { parse } from 'cookie';
import fetch from 'node-fetch';
import { setTimeout } from 'timers/promises';
// @ts-ignore This module has no typings
import timestamp from 'unix-timestamp';
import { describe, expect, it } from 'vitest';
import { CookieUserSessionMiddleware, type CookieUserSessionMiddlewareOptions, UserSessionRedisStorage } from '../lib/index.js';
import { PORT } from './bootstrap.js';
import { options } from './fixtures/middleware.js';
import { routes } from './fixtures/routes.js';
import type { GetActiveSessionsBody } from './fixtures/server.js';

const serverAddress = `http://localhost:${PORT}`;

const { AUTHORIZATION, COOKIE, USER_AGENT } = HttpRequestHeaderEnum;
const { CACHE_CONTROL, SET_COOKIE } = HttpResponseHeaderEnum;

describe(`${CookieUserSessionMiddleware.name} spec`, () => {
	describe('configuration spec', () => {
		it('should not allow invalid config', () => {
			const middlewareOpts: CookieUserSessionMiddlewareOptions = {
				sessionManager: {
					idLength: 18,
					sessionTtl: 5,
					timeouts: {
						idle: 3,
						renewal: 2,
						oldSessionAvailabilityAfterRenewal: 1
					},
					renewSessionHooks: {
						onRenewMadeAlreadyFromCurrentProcess() {
							return undefined;
						},
						onRenewMadeAlreadyFromAnotherProcess() {
							return undefined;
						},
						onOldSessionDeleteFailure() {
							return undefined;
						}
					},
					storage: new UserSessionRedisStorage({
						keyPrefix: {
							sessions: 'sids',
							sessionId: 'sid'
						},
						concurrentSessions: 2,
						serializer: AVRO_SERIALIZER
					})
				},
				session: {
					cookie: {
						name: 'sid',
						path: '/api',
						sameSite: 'strict',
						persistent: true
					},
					header: 'x-session-id',
					csrf: {
						name: 'x-requested-with',
						value: 'XmlHttpRequest'
					},
					'cache-control': true
				}
			};

			// 1
			let old = middlewareOpts.session.cookie.name;
			middlewareOpts.session.cookie.name = `__Host-${old}`;
			expect(() => new CookieUserSessionMiddleware(middlewareOpts)).to.throw(
				`Session cookie name is not allowed to start with '__Host-'. Given: ${middlewareOpts.session.cookie.name}.`
			);
			middlewareOpts.session.cookie.name = old;

			// 2
			old = middlewareOpts.session.cookie.name;
			middlewareOpts.session.cookie.name = `__Secure-${old}`;
			expect(() => new CookieUserSessionMiddleware(middlewareOpts)).to.throw(
				`Session cookie name is not allowed to start with '__Secure-'. Given: ${middlewareOpts.session.cookie.name}.`
			);
			middlewareOpts.session.cookie.name = old;

			// 3
			old = middlewareOpts.session.cookie.name;
			middlewareOpts.session.cookie.name = 'NAME';
			expect(() => new CookieUserSessionMiddleware(middlewareOpts)).to.throw(
				`Cookie name should be lowercase. Given: ${middlewareOpts.session.cookie.name}.`
			);
			middlewareOpts.session.cookie.name = old;
		});
	});

	describe('session lifetime spec', () => {
		it("authenticates, get's resource and logs out (mobile device)", async () => {
			/* AUTHENTICATE */
			const authResp = await fetch(`${serverAddress}${routes.login.path}?location=1`, {
				method: routes.login.method
			});
			expect(authResp.status).to.be.eq(HttpStatusCode.Created);
			expect(authResp.headers.has(CACHE_CONTROL)).to.be.eq(false); // only set for browsers

			/* GET RESOURCE */
			const getResourceTimestamp = timestamp.now();
			const sessionId = authResp.headers.get(options.session.header)!;
			const resourceResp = await fetch(`${serverAddress}${routes.get_resource.path}?uid=uid1`, {
				method: routes.get_resource.method,
				headers: {
					[AUTHORIZATION]: `Bearer ${sessionId}`
				}
			});
			expect(resourceResp.status).to.be.eq(HttpStatusCode.Ok);
			const resource = (await resourceResp.json()) as UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>;

			expect(resource.ip).to.be.oneOf(['::1', '::ffff:127.0.0.1']);
			expect(resource.device).to.be.eq(null);
			expect(resource.location).to.be.deep.eq({
				countryCode: 'RO',
				regionCode: null,
				city: 'Bucharest',
				latitude: 15.600000381469727,
				longitude: null,
				timezone: null
			});
			expect(resource.expiresAt - resource.createdAt).to.be.eq(options.sessionManager.sessionTtl);
			expect(resource.accessedAt).to.be.closeTo(getResourceTimestamp, 1);

			/* GET ACTIVE SESSIONS (before logout) */
			const getActiveSessionsBeforeLogoutResp = await fetch(`${serverAddress}${routes.get_active_sessions.path}?uid=uid1`, {
				method: routes.get_active_sessions.method,
				headers: {
					[AUTHORIZATION]: `Bearer ${sessionId}`
				}
			});
			expect(getActiveSessionsBeforeLogoutResp.status).to.be.eq(HttpStatusCode.Ok);

			const activeSessionsBeforeLogout = (await getActiveSessionsBeforeLogoutResp.json()) as GetActiveSessionsBody;
			expect(Object.keys(activeSessionsBeforeLogout)).toStrictEqual([sessionId]);

			/* LOGOUT */
			const logoutResp = await fetch(`${serverAddress}${routes.logout.path}?uid=uid1`, {
				method: routes.logout.method,
				headers: {
					[AUTHORIZATION]: `Bearer ${sessionId}`
				}
			});
			expect(logoutResp.status).to.be.eq(HttpStatusCode.Ok);

			/* GET ACTIVE SESSIONS (after logout) */
			const getActiveSessionsResp = await fetch(`${serverAddress}${routes.get_active_sessions.path}?uid=uid1`, {
				method: routes.get_active_sessions.method,
				headers: {
					[AUTHORIZATION]: `Bearer ${sessionId}`
				}
			});
			expect(getActiveSessionsResp.status).to.be.eq(HttpStatusCode.Ok);

			const activeSessions = (await getActiveSessionsResp.json()) as GetActiveSessionsBody;
			expect(Object.keys(activeSessions)).to.have.length(0);
		});

		it("authenticates, get's resource and logs out (browser device)", async () => {
			/* AUTHENTICATE */
			const authResp = await fetch(`${serverAddress}${routes.login.path}?location=1`, {
				method: routes.login.method,
				headers: {
					[USER_AGENT]: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36 OPR/38.0.2220.41'
				}
			});
			expect(authResp.status).to.be.eq(HttpStatusCode.Created);
			expect(authResp.headers.get(CACHE_CONTROL)).to.be.eq('no-cache="set-cookie, set-cookie2"'); // only set for browsers

			/* GET RESOURCE */
			const cookie = authResp.headers.get(SET_COOKIE)!;
			const getResourceTimestamp = timestamp.now();
			const resourceResp = await fetch(`${serverAddress}${routes.get_resource.path}?uid=uid1`, {
				method: routes.get_resource.method,
				headers: {
					[COOKIE]: cookie,
					[USER_AGENT]: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36 OPR/38.0.2220.41',
					[options.session.csrf.name]: options.session.csrf.value as string
				}
			});
			expect(resourceResp.status).to.be.eq(HttpStatusCode.Ok);
			const resource = (await resourceResp.json()) as UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>;

			expect(resource.ip).to.be.oneOf(['::1', '::ffff:127.0.0.1']);
			expect(resource.device).to.be.deep.eq({
				name: ' ',
				type: 'desktop',
				client: { name: 'Opera', type: 'browser', version: '38.0' },
				os: { name: 'GNU/Linux', version: '', platform: 'x64' }
			});
			expect(resource.location).to.be.deep.eq({
				countryCode: 'RO',
				regionCode: null,
				city: 'Bucharest',
				latitude: 15.600000381469727,
				longitude: null,
				timezone: null
			});
			expect(resource.expiresAt - resource.createdAt).to.be.eq(options.sessionManager.sessionTtl);
			expect(resource.accessedAt).to.be.closeTo(getResourceTimestamp, 1);

			/* LOGOUT */
			const logoutResp = await fetch(`${serverAddress}${routes.logout.path}?uid=uid1`, {
				method: routes.logout.method,
				headers: {
					[COOKIE]: cookie,
					[options.session.csrf.name]: options.session.csrf.value as string
				}
			});
			expect(logoutResp.status).to.be.eq(HttpStatusCode.Ok);
			expect(logoutResp.headers.get(SET_COOKIE)).to.be.eq(
				`${options.session.cookie.name}=; Path=${
					options.session.cookie.path
				}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=${capitalize(options.session.cookie.sameSite as string)}`
			);

			/* GET ACTIVE SESSIONS */
			const getActiveSessionsResp = await fetch(`${serverAddress}${routes.get_active_sessions.path}?uid=uid1`, {
				method: routes.get_active_sessions.method
			});
			expect(getActiveSessionsResp.status).to.be.eq(HttpStatusCode.Ok);

			const activeSessions = (await getActiveSessionsResp.json()) as GetActiveSessionsBody;
			expect(Object.keys(activeSessions)).to.have.length(0);
		});

		it('creates multiple simultaneous sessions', async () => {
			/* AUTHENTICATE */
			const [firstAuthResp, secondAuthResp] = await Promise.all([
				fetch(`${serverAddress}${routes.login.path}?location=1`, {
					method: routes.login.method,
					headers: {
						[USER_AGENT]:
							'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36 OPR/38.0.2220.41'
					}
				}),
				fetch(`${serverAddress}${routes.login.path}?location=1`, {
					method: routes.login.method
				})
			]);
			expect(firstAuthResp.status).to.be.eq(HttpStatusCode.Created);
			expect(secondAuthResp.status).to.be.eq(HttpStatusCode.Created);

			/* GET ACTIVE SESSIONS */
			const getActiveSessionsResp = await fetch(`${serverAddress}${routes.get_active_sessions.path}?uid=uid1`, {
				method: routes.get_active_sessions.method
			});
			expect(getActiveSessionsResp.status).to.be.eq(HttpStatusCode.Ok);

			const activeSessions = (await getActiveSessionsResp.json()) as GetActiveSessionsBody;
			if (options.sessionManager.timeouts!.oldSessionAvailabilityAfterRenewal) {
				const firstSessionId = Object.entries(parse(firstAuthResp.headers.get(SET_COOKIE)!))[0][1];
				const secondSessionId = secondAuthResp.headers.get(options.session.header)!;
				expect(Object.keys(activeSessions)).toStrictEqual([secondSessionId, firstSessionId]);
			} else {
				expect(Object.keys(activeSessions)).to.have.length(0);
			}

			/* LOGOUT */
			const [fistLogoutResp, secondLogoutResp] = await Promise.all([
				fetch(`${serverAddress}${routes.logout.path}?uid=uid1`, {
					method: routes.logout.method,
					headers: {
						[COOKIE]: firstAuthResp.headers.get(SET_COOKIE)!,
						[options.session.csrf.name]: options.session.csrf.value as string
					}
				}),
				fetch(`${serverAddress}${routes.logout.path}?uid=uid1`, {
					method: routes.logout.method,
					headers: {
						[AUTHORIZATION]: `Bearer ${secondAuthResp.headers.get(options.session.header)}`
					}
				})
			]);
			expect(fistLogoutResp.status).to.be.eq(HttpStatusCode.Ok);
			expect(secondLogoutResp.status).to.be.eq(HttpStatusCode.Ok);
		});
	});

	describe('verify session spec', () => {
		it('sends back renewed session id after getting resource', { timeout: options.sessionManager.timeouts!.renewal! * 1000 + 4000 }, async () => {
			/* AUTHENTICATE */
			const authResp = await fetch(`${serverAddress}${routes.login.path}?location=1`, {
				method: routes.login.method,
				headers: {
					[USER_AGENT]: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36 OPR/38.0.2220.41'
				}
			});
			expect(authResp.status).to.be.eq(HttpStatusCode.Created);
			expect(authResp.headers.get(CACHE_CONTROL)).to.be.eq('no-cache="set-cookie, set-cookie2"'); // only set for browsers

			/* GET RESOURCE and OBTAIN REFRESHED SESSION */
			await setTimeout(options.sessionManager.timeouts!.renewal! * 1000 + 100, { ref: true });

			const cookie = authResp.headers.get(SET_COOKIE)!;
			const resourceResp = await fetch(`${serverAddress}${routes.get_resource.path}?uid=uid1`, {
				method: routes.get_resource.method,
				headers: {
					[COOKIE]: cookie,
					[USER_AGENT]: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36 OPR/38.0.2220.41',
					[options.session.csrf.name]: options.session.csrf.value as string
				}
			});
			expect(resourceResp.status).to.be.eq(HttpStatusCode.Ok);
			const resource = (await resourceResp.json()) as UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>;
			expect(resource.accessedAt).to.be.eq(-1); // the old session was invalidated

			/* LOGOUT WITH RENEWED SESSION */
			const logoutResp = await fetch(`${serverAddress}${routes.logout.path}?uid=uid1`, {
				method: routes.logout.method,
				headers: {
					[COOKIE]: resourceResp.headers.get(SET_COOKIE)!,
					[options.session.csrf.name]: options.session.csrf.value as string
				}
			});
			expect(logoutResp.status).to.be.eq(HttpStatusCode.Ok);

			/* GET ACTIVE SESSIONS */
			const getActiveSessionsResp = await fetch(`${serverAddress}${routes.get_active_sessions.path}?uid=uid1`, {
				method: routes.get_active_sessions.method
			});
			expect(getActiveSessionsResp.status).to.be.eq(HttpStatusCode.Ok);

			const activeSessions = (await getActiveSessionsResp.json()) as GetActiveSessionsBody;
			if (options.sessionManager.timeouts!.oldSessionAvailabilityAfterRenewal) {
				const oldSessionId = Object.entries(parse(cookie))[0][1];
				expect(Object.keys(activeSessions)).toStrictEqual([oldSessionId]);
			} else {
				expect(Object.keys(activeSessions)).to.have.length(0);
			}
		});

		it('updates accessedAt each time session is verified', async () => {
			/* AUTHENTICATE */
			const authResp = await fetch(`${serverAddress}${routes.login.path}?location=1`, {
				method: routes.login.method,
				headers: {
					[USER_AGENT]: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36 OPR/38.0.2220.41'
				}
			});
			expect(authResp.status).to.be.eq(HttpStatusCode.Created);
			expect(authResp.headers.get(CACHE_CONTROL)).to.be.eq('no-cache="set-cookie, set-cookie2"'); // only set for browsers
			const cookie = authResp.headers.get(SET_COOKIE)!;

			/* GET RESOURCE (first time) */
			const getFirstResourceTimestamp = timestamp.now();
			const resourceFirstResp = await fetch(`${serverAddress}${routes.get_resource.path}?uid=uid1`, {
				method: routes.get_resource.method,
				headers: {
					[COOKIE]: cookie,
					[USER_AGENT]: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36 OPR/38.0.2220.41',
					[options.session.csrf.name]: options.session.csrf.value as string
				}
			});
			expect(resourceFirstResp.status).to.be.eq(HttpStatusCode.Ok);
			const resourceOne = (await resourceFirstResp.json()) as UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>;
			expect(resourceOne.accessedAt).to.be.closeTo(getFirstResourceTimestamp, 1);

			/* GET RESOURCE (second time) */
			await setTimeout(1100, { ref: true });

			const resourceSecondResp = await fetch(`${serverAddress}${routes.get_resource.path}?uid=uid1`, {
				method: routes.get_resource.method,
				headers: {
					[COOKIE]: cookie,
					[USER_AGENT]: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36 OPR/38.0.2220.41',
					[options.session.csrf.name]: options.session.csrf.value as string
				}
			});
			expect(resourceSecondResp.status).to.be.eq(HttpStatusCode.Ok);
			const resourceTwo = (await resourceSecondResp.json()) as UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>;
			expect(resourceTwo.accessedAt - resourceOne.accessedAt).to.be.oneOf([0, 1]); // depending how ms are rounded to s
		});

		it("doesn't accept invalid session ids", async () => {
			const resourceResp = await fetch(`${serverAddress}${routes.get_resource.path}?uid=uid1`, {
				method: routes.get_resource.method,
				headers: {
					[COOKIE]: `${options.session.cookie.name}=''`,
					[USER_AGENT]: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36 OPR/38.0.2220.41',
					[options.session.csrf.name]: options.session.csrf.value as string
				}
			});
			expect(resourceResp.status).to.be.eq(HttpStatusCode.Forbidden);

			const error = (await resourceResp.json()) as { message: string };
			expect(error.message).to.be.oneOf([
				'Session \'tu5gkmwKQmrdy7fgh9QnRJjzWxw=\' doesn\'t exist. Context: {"ip":"::1","device":{"name":" ","type":"desktop","client":{"type":"browser","name":"Opera","version":"38.0","engine":"Blink","engineVersion":""},"os":{"name":"GNU/Linux","version":"","platform":"x64"}},"location":null}.',
				'Session \'tu5gkmwKQmrdy7fgh9QnRJjzWxw=\' doesn\'t exist. Context: {"ip":"::ffff:127.0.0.1","device":{"name":" ","type":"desktop","client":{"type":"browser","name":"Opera","version":"38.0","engine":"Blink","engineVersion":""},"os":{"name":"GNU/Linux","version":"","platform":"x64"}},"location":null}.'
			]);

			expect(resourceResp.headers.get(SET_COOKIE)).to.be.eq(
				`${options.session.cookie.name}=; Path=${
					options.session.cookie.path
				}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=${capitalize(options.session.cookie.sameSite as string)}`
			);
		});

		it("doesn't accept requests that do not contain session id", async () => {
			const resourceResp = await fetch(`${serverAddress}${routes.get_resource.path}?uid=uid1`, {
				method: routes.get_resource.method
			});
			expect(resourceResp.status).to.be.eq(HttpStatusCode.Forbidden);

			const error = (await resourceResp.json()) as { message: string };
			expect(error.message).to.be.eq('Authorization header value not present.');

			expect(resourceResp.headers.get(SET_COOKIE)).to.be.eq(null); // will set it only when session is GIVEN and NOT VALID
		});

		it("doesn't accept requests that do not contain csrf protection", async () => {
			const resourceResp = await fetch(`${serverAddress}${routes.get_resource.path}?uid=uid1`, {
				method: routes.get_resource.method,
				headers: {
					[COOKIE]: `${options.session.cookie.name}=''`,
					[USER_AGENT]: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36 OPR/38.0.2220.41'
				}
			});
			expect(resourceResp.status).to.be.eq(HttpStatusCode.Forbidden);

			const error = (await resourceResp.json()) as { message: string };
			expect(error.message).to.be.eq("CSRF header value 'undefined' differs from the expected one.");

			expect(resourceResp.headers.get(SET_COOKIE)).to.be.eq(null); // will set it only when session is GIVEN and NOT VALID
		});

		it("doesn't accept expired session ids after idle period", { timeout: (options.sessionManager.timeouts!.idle! + 2) * 1000 }, async () => {
			const renewalTimeoutSnapshot = options.sessionManager.timeouts!.renewal;

			try {
				(options.sessionManager.timeouts! as MutableSome<UserSessionTimeouts, 'renewal'>).renewal = undefined;

				/* AUTHENTICATE */
				const authResp = await fetch(`${serverAddress}${routes.login.path}?location=1`, {
					method: routes.login.method,
					headers: {
						[USER_AGENT]:
							'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36 OPR/38.0.2220.41'
					}
				});
				expect(authResp.status).to.be.eq(HttpStatusCode.Created);

				/* GET RESOURCE AFTER BEING IDLE */
				await setTimeout(options.sessionManager.timeouts!.idle! * 1000 + 100, { ref: true });

				const cookie = authResp.headers.get(SET_COOKIE)!;
				const resourceResp = await fetch(`${serverAddress}${routes.get_resource.path}?uid=uid1`, {
					method: routes.get_resource.method,
					headers: {
						[COOKIE]: cookie,
						[USER_AGENT]:
							'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36 OPR/38.0.2220.41',
						[options.session.csrf.name]: options.session.csrf.value as string
					}
				});
				expect(resourceResp.status).to.be.eq(HttpStatusCode.Forbidden);

				const error = (await resourceResp.json()) as { message: string };
				expect(error.message).to.match(/^Session '.+' it's expired, because it was idle for \d seconds. Context:/);

				expect(resourceResp.headers.get(SET_COOKIE)).to.be.eq(
					`${options.session.cookie.name}=; Path=${
						options.session.cookie.path
					}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=${capitalize(options.session.cookie.sameSite as string)}`
				);
			} finally {
				(options.sessionManager.timeouts! as MutableSome<UserSessionTimeouts, 'renewal'>).renewal = renewalTimeoutSnapshot;
			}
		});
	});

	describe('renew session spec', () => {
		it('renews user session', async () => {
			/* AUTHENTICATE */
			const authResp = await fetch(`${serverAddress}${routes.login.path}?location=1`, {
				method: routes.login.method,
				headers: {
					[USER_AGENT]: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36 OPR/38.0.2220.41'
				}
			});
			expect(authResp.status).to.be.eq(HttpStatusCode.Created);
			expect(authResp.headers.get(CACHE_CONTROL)).to.be.eq('no-cache="set-cookie, set-cookie2"'); // only set for browsers

			/* RENEW */
			const cookie = authResp.headers.get(SET_COOKIE)!;
			const renewResp = await fetch(`${serverAddress}${routes.renew_session.path}?uid=uid1`, {
				method: routes.renew_session.method,
				headers: {
					[COOKIE]: cookie,
					[USER_AGENT]: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36 OPR/38.0.2220.41',
					[options.session.csrf.name]: options.session.csrf.value as string
				}
			});
			expect(renewResp.status).to.be.eq(HttpStatusCode.Ok);

			/* LOGOUT (with renewed cookie) */
			const renewedCookie = renewResp.headers.get(SET_COOKIE)!;
			const logoutResp = await fetch(`${serverAddress}${routes.logout.path}?uid=uid1`, {
				method: routes.logout.method,
				headers: {
					[COOKIE]: renewedCookie,
					[options.session.csrf.name]: options.session.csrf.value as string
				}
			});
			expect(logoutResp.status).to.be.eq(HttpStatusCode.Ok);

			/* GET ACTIVE SESSIONS */
			const getActiveSessionsResp = await fetch(`${serverAddress}${routes.get_active_sessions.path}?uid=uid1`, {
				method: routes.get_active_sessions.method
			});
			expect(getActiveSessionsResp.status).to.be.eq(HttpStatusCode.Ok);

			const activeSessions = (await getActiveSessionsResp.json()) as GetActiveSessionsBody;
			if (options.sessionManager.timeouts!.oldSessionAvailabilityAfterRenewal) {
				const oldSessionId = Object.entries(parse(cookie))[0][1];
				expect(Object.keys(activeSessions)).toStrictEqual([oldSessionId]);
			} else {
				expect(Object.keys(activeSessions)).to.have.length(0);
			}
		});
	});
});

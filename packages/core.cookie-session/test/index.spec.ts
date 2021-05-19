import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import fetch from 'node-fetch';
// @ts-ignore
import timestamp from 'unix-timestamp';
import { HttpRequestHeaderEnum, HttpResponseHeaderEnum, HttpStatusCode } from '@thermopylae/core.declarations';
import type { HTTPRequestLocation, MutableSome } from '@thermopylae/core.declarations';
import type { UserSessionMetaData, UserSessionTimeouts } from '@thermopylae/lib.user-session';
import type { UserSessionDevice } from '@thermopylae/core.user-session.commons';
import { setTimeout } from 'timers/promises';
import { parse, serialize } from 'cookie';
import { CookieUserSessionMiddleware } from '../lib';
import { routes } from './fixtures/routes';
import { options } from './fixtures/middleware';
import { PORT } from './bootstrap';

const serverAddress = `http://localhost:${PORT}`;

const { AUTHORIZATION, COOKIE, USER_AGENT } = HttpRequestHeaderEnum;
const { CACHE_CONTROL, SET_COOKIE } = HttpResponseHeaderEnum;

describe(`${CookieUserSessionMiddleware.name} spec`, () => {
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

			expect(resource.ip).to.be.eq('::ffff:127.0.0.1');
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

			const activeSessionsBeforeLogout = await getActiveSessionsBeforeLogoutResp.json();
			expect(Object.keys(activeSessionsBeforeLogout)).to.be.equalTo([sessionId]);

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

			const activeSessions = await getActiveSessionsResp.json();
			expect(Object.keys(activeSessions)).to.be.ofSize(0);
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

			expect(resource.ip).to.be.eq('::ffff:127.0.0.1');
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
				serialize(options.session.cookie.name, '', {
					expires: new Date('Thu, 01 Jan 1970 00:00:00 GMT')
				})
			);

			/* GET ACTIVE SESSIONS */
			const getActiveSessionsResp = await fetch(`${serverAddress}${routes.get_active_sessions.path}?uid=uid1`, {
				method: routes.get_active_sessions.method
			});
			expect(getActiveSessionsResp.status).to.be.eq(HttpStatusCode.Ok);

			const activeSessions = await getActiveSessionsResp.json();
			expect(Object.keys(activeSessions)).to.be.ofSize(0);
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

			const activeSessions = await getActiveSessionsResp.json();
			if (options.sessionManager.timeouts!.oldSessionAvailabilityTimeoutAfterRenewal) {
				const firstSessionId = Object.entries(parse(firstAuthResp.headers.get(SET_COOKIE)!))[0][1];
				const secondSessionId = secondAuthResp.headers.get(options.session.header)!;
				expect(Object.keys(activeSessions)).to.be.equalTo([secondSessionId, firstSessionId]);
			} else {
				expect(Object.keys(activeSessions)).to.be.ofSize(0);
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
		it('sends back renewed session id after getting resource', async () => {
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
			await setTimeout(options.sessionManager.timeouts!.renewal! * 1000 + 100);

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

			const activeSessions = await getActiveSessionsResp.json();
			if (options.sessionManager.timeouts!.oldSessionAvailabilityTimeoutAfterRenewal) {
				const oldSessionId = Object.entries(parse(cookie))[0][1];
				expect(Object.keys(activeSessions)).to.be.equalTo([oldSessionId]);
			} else {
				expect(Object.keys(activeSessions)).to.be.ofSize(0);
			}
		}).timeout(options.sessionManager.timeouts!.renewal! * 1000 + 4000);

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
			await setTimeout(1100);

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
			expect(error.message).to.be.eq(
				'Session \'tu5gkmwKQmrdy7fgh9QnRJjzWxw=\' doesn\'t exist. Context: {"ip":"::ffff:127.0.0.1","device":{"name":" ","type":"desktop","client":{"type":"browser","name":"Opera","version":"38.0","engine":"Blink","engineVersion":""},"os":{"name":"GNU/Linux","version":"","platform":"x64"}},"location":null}.'
			);

			expect(resourceResp.headers.get(SET_COOKIE)).to.be.eq(
				serialize(options.session.cookie.name, '', {
					expires: new Date('Thu, 01 Jan 1970 00:00:00 GMT')
				})
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

		it("doesn't accept expired session ids after idle period", async () => {
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
				await setTimeout(options.sessionManager.timeouts!.idle! * 1000 + 100);

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
					serialize(options.session.cookie.name, '', {
						expires: new Date('Thu, 01 Jan 1970 00:00:00 GMT')
					})
				);
			} finally {
				(options.sessionManager.timeouts! as MutableSome<UserSessionTimeouts, 'renewal'>).renewal = renewalTimeoutSnapshot;
			}
		}).timeout((options.sessionManager.timeouts!.idle! + 2) * 1000);
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

			const activeSessions = await getActiveSessionsResp.json();
			if (options.sessionManager.timeouts!.oldSessionAvailabilityTimeoutAfterRenewal) {
				const oldSessionId = Object.entries(parse(cookie))[0][1];
				expect(Object.keys(activeSessions)).to.be.equalTo([oldSessionId]);
			} else {
				expect(Object.keys(activeSessions)).to.be.ofSize(0);
			}
		});
	});
});

import { FastifyRequestAdapter, FastifyResponseAdapter, LOCATION_SYM } from '@thermopylae/core.adapter.fastify';
import cookie from 'fastify-cookie';
import fastify, { FastifyInstance } from 'fastify';
import { HttpStatusCode, HttpVerb } from '@thermopylae/core.declarations';
import { logger } from '@thermopylae/lib.unit-test';
import { InvalidAccessTokensMemCache, JwtUserSessionMiddleware, JwtUserSessionMiddlewareOptions, RefreshTokensRedisStorage } from '../lib';

const server = fastify({
	logger: {
		level: 'error'
	},
	trustProxy: true
});
server.register(cookie);

const options: JwtUserSessionMiddlewareOptions = {
	jwt: {
		secret: 'secret',
		signOptions: {
			algorithm: 'HS384',
			issuer: 'auth-server.com',
			audience: ['auth-server.com', 'rest-server.com'],
			expiresIn: 2
		},
		verifyOptions: {
			algorithms: ['HS384'],
			issuer: 'auth-server.com',
			audience: 'rest-server.com'
		},
		invalidationOptions: {
			refreshTokenTtl: 3,
			refreshTokenLength: 18,
			invalidAccessTokensCache: new InvalidAccessTokensMemCache(),
			refreshTokensStorage: new RefreshTokensRedisStorage({
				keyPrefix: {
					sessions: 'reftoks',
					refreshToken: 'reftok'
				},
				concurrentSessions: 2
			})
		}
	},
	session: {
		cookies: {
			name: {
				signature: 'sig',
				payload: 'pld',
				refresh: 'rfsh'
			},
			path: {
				access: '/api',
				refresh: '/session'
			},
			sameSite: 'strict',
			persistent: true
		},
		headers: {
			access: 'x-access-token',
			refresh: 'x-refresh-token'
		},
		csrfHeader: {
			name: 'x-requested-with',
			value: 'XmlHttpRequest'
		}
	}
};

const middleware = new JwtUserSessionMiddleware(options);

type EndpointOperation = 'login' | 'get_resource' | 'get_active_sessions' | 'renew_session' | 'logout' | 'logout_from_all_sessions';
const routes: Readonly<Record<EndpointOperation, { path: string; method: HttpVerb & keyof FastifyInstance }>> = {
	login: {
		path: '/login',
		method: 'post'
	},
	get_resource: {
		path: '/resource',
		method: 'get'
	},
	get_active_sessions: {
		path: '/sessions',
		method: 'get'
	},
	renew_session: {
		path: '/session',
		method: 'put'
	},
	logout: {
		path: '/session',
		method: 'delete'
	},
	logout_from_all_sessions: {
		path: '/sessions',
		method: 'delete'
	}
};

server[routes.login.method](routes.login.path, async (req, res) => {
	const request = new FastifyRequestAdapter(req);
	const response = new FastifyResponseAdapter(res);

	// @ts-ignore
	req[LOCATION_SYM] = {
		countryCode: 'RO',
		regionCode: 'B',
		city: 'Bucharest',
		latitude: 15.6,
		longitude: 18.6,
		timezone: 'Bucharest +2'
	};

	try {
		await middleware.create(request, response, { role: 'user' }, { subject: 'uid1' });
		response.status(HttpStatusCode.Created).send();
	} catch (e) {
		response.status(HttpStatusCode.BadRequest).send({ message: e.message });
	}
});
server[routes.get_resource.method](routes.get_resource.path, async (req, res) => {
	const request = new FastifyRequestAdapter(req);
	const response = new FastifyResponseAdapter(res);

	try {
		const jwtPayload = await middleware.verify(request, response);
		response.status(HttpStatusCode.Ok).send({ rest: 'resource', role: jwtPayload.role });
	} catch (e) {
		logger.warning(`${routes.get_resource.path}`, e);
		response.status(HttpStatusCode.Forbidden).send({ message: e.message });
	}
});
server[routes.get_active_sessions.method](routes.get_active_sessions.path, async (req, res) => {
	const request = new FastifyRequestAdapter(req);
	const response = new FastifyResponseAdapter(res);

	const subject = request.query('uid') ? request.query('uid')! : (await middleware.verify(request, response)).sub;
	const activeSessions = await middleware.sessionManager.readAll(subject);
	response.send(Object.fromEntries(activeSessions));
});
server[routes.renew_session.method](routes.renew_session.path, async (req, res) => {
	const request = new FastifyRequestAdapter(req);
	const response = new FastifyResponseAdapter(res);

	try {
		await middleware.refresh(request, response, { role: 'user' }, { subject: request.query('uid')! });
		response.status(HttpStatusCode.Ok).send();
	} catch (e) {
		logger.warning(`${routes.renew_session.path}`, e);
		response.status(HttpStatusCode.NotFound).send();
	}
});
server[routes.logout.method](routes.logout.path, async (req, res) => {
	const request = new FastifyRequestAdapter(req);
	const response = new FastifyResponseAdapter(res);

	if (request.query('uid')) {
		await middleware.delete(request, response, request.query('uid')!, undefined, false);
	} else {
		const jwtPayload = await middleware.verify(request, response);
		await middleware.delete(request, response, jwtPayload.sub, jwtPayload);
	}

	response.status(HttpStatusCode.Ok).send();
});
server[routes.logout_from_all_sessions.method](routes.logout_from_all_sessions.path, async (req, res) => {
	const request = new FastifyRequestAdapter(req);
	const response = new FastifyResponseAdapter(res);

	if (request.query('uid')) {
		response.send({ sessions: await middleware.sessionManager.deleteAll(request.query('uid')!) });
	} else {
		const jwtPayload = await middleware.verify(request, response);
		const deletedSessions = await middleware.sessionManager.deleteAll(jwtPayload.sub, jwtPayload);

		response.send({ sessions: deletedSessions });
	}
});

export { server, middleware, options, routes };

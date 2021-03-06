import { FastifyRequestAdapter, FastifyResponseAdapter, LOCATION_SYM } from '@thermopylae/core.adapter.fastify';
import cookie from 'fastify-cookie';
import fastify, { FastifyInstance } from 'fastify';
import { HttpStatusCode, HttpVerb } from '@thermopylae/core.declarations';
import { UserSessionRedisStorage, UserSessionRedisStorageOptions } from '@thermopylae/core.user-session.commons';
// eslint-disable-next-line import/extensions
import { AVRO_SERIALIZER } from '@thermopylae/core.user-session.commons/dist/storage/serializers/jwt/avro';
import { logger } from '@thermopylae/dev.unit-test';
import { InvalidAccessTokensMemCache, JwtUserSessionMiddleware, JwtUserSessionMiddlewareOptions } from '../lib';

const server = fastify({
	logger: {
		level: 'error'
	},
	trustProxy: true
});
server.register(cookie);

const refreshTokenStorageOptions: UserSessionRedisStorageOptions = Object.seal({
	keyPrefix: {
		sessions: 'reftoks',
		sessionId: 'reftok'
	},
	concurrentSessions: 2,
	serializer: AVRO_SERIALIZER
});

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
			refreshTokensStorage: new UserSessionRedisStorage(refreshTokenStorageOptions)
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
				'access-payload': '/',
				'access-signature': '/api',
				refresh: '/session'
			},
			sameSite: 'strict',
			persistentAccessToken: true
		},
		headers: {
			access: 'x-access-token',
			refresh: 'x-refresh-token'
		},
		csrfHeader: {
			name: 'x-requested-with',
			value: 'XmlHttpRequest'
		},
		deliveryOfJwtPayloadViaCookie: true,
		'cache-control': true
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

	if (request.query('location') === '1') {
		// @ts-ignore This is for testing purposes
		req[LOCATION_SYM] = {
			countryCode: 'RO',
			regionCode: null,
			city: 'Bucharest',
			latitude: 15.6,
			longitude: null,
			timezone: null
		};
	}

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
		await middleware.delete(request, response, jwtPayload.sub, jwtPayload, !!request.query('unset-cookies'));
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

export { server, middleware, options, refreshTokenStorageOptions, routes };

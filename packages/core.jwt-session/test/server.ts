import { FastifyRequestAdapter, FastifyResponseAdapter } from '@thermopylae/core.adapter.fastify';
import cookie from 'fastify-cookie';
import fastify, { FastifyInstance } from 'fastify';
import { HttpVerb } from '@thermopylae/core.declarations';
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
			expiresIn: 3
		},
		verifyOptions: {
			algorithms: ['HS384'],
			issuer: 'auth-server.com',
			audience: 'rest-server.com'
		},
		invalidationOptions: {
			refreshTokenTtl: 5,
			refreshTokenLength: 18,
			invalidAccessTokensCache: new InvalidAccessTokensMemCache(),
			refreshTokensStorage: new RefreshTokensRedisStorage({
				keyPrefix: {
					sessions: 'reftoks',
					refreshToken: 'reftok'
				},
				concurrentSessions: 3
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
			sameSite: 'strict'
		},
		headers: {
			access: 'x-access-token',
			refresh: 'x-refresh-token'
		},
		csrfHeader: {
			name: 'x-requested-with',
			value: 'XmlHttpRequest'
		},
		persistent: true
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

	await middleware.create(request, response, { role: 'user' }, { subject: 'uid1' });

	response.status(201).send();
});
server[routes.get_resource.method](routes.get_resource.path, async (req, res) => {
	const request = new FastifyRequestAdapter(req);
	const response = new FastifyResponseAdapter(res);

	const jwtPayload = await middleware.verify(request, response);
	response.status(200).send({ rest: 'resource', role: jwtPayload.role });
});
server[routes.get_active_sessions.method](routes.get_active_sessions.path, async (req, res) => {
	const request = new FastifyRequestAdapter(req);
	const response = new FastifyResponseAdapter(res);

	const jwtPayload = await middleware.verify(request, response);
	const activeSessions = await middleware.sessionManager.readAll(jwtPayload.sub);
	response.send(activeSessions);
});
server[routes.renew_session.method](routes.renew_session.path, async (req, res) => {
	const request = new FastifyRequestAdapter(req);
	const response = new FastifyResponseAdapter(res);

	await middleware.refresh(request, response, { role: 'user' }, { subject: request.query('uid')! });
	response.send();
});
server[routes.logout.method](routes.logout.path, async (req, res) => {
	const request = new FastifyRequestAdapter(req);
	const response = new FastifyResponseAdapter(res);

	const jwtPayload = await middleware.verify(request, response);
	await middleware.delete(request, response, jwtPayload);

	response.status(200).send();
});
server[routes.logout_from_all_sessions.method](routes.logout_from_all_sessions.path, async (req, res) => {
	const request = new FastifyRequestAdapter(req);
	const response = new FastifyResponseAdapter(res);

	const jwtPayload = await middleware.verify(request, response);
	const deletedSessions = await middleware.sessionManager.deleteAll(jwtPayload);

	response.send({ sessions: deletedSessions });
});

export { server, options, routes };

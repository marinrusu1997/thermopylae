import { FastifyRequestAdapter, FastifyResponseAdapter } from '@thermopylae/core.adapter.fastify';
import cookie from 'fastify-cookie';
import fastify from 'fastify';
import { InvalidAccessTokensMemCache, JwtUserSessionMiddleware, JwtUserSessionMiddlewareOptions, RefreshTokensRedisStorage } from '../lib';

const server = fastify({
	logger: false,
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

server.post('/login', async (req, res) => {
	const request = new FastifyRequestAdapter(req);
	const response = new FastifyResponseAdapter(res);

	await middleware.create(request, response, { role: 'user' }, { subject: 'uid1' });

	response.send();
});
server.get('/resource', async (req, res) => {
	const request = new FastifyRequestAdapter(req);
	const response = new FastifyResponseAdapter(res);

	const jwtPayload = await middleware.verify(request, response);
	response.send({ rest: 'resource', role: jwtPayload.role });
});
server.get('/sessions', async (req, res) => {
	const request = new FastifyRequestAdapter(req);
	const response = new FastifyResponseAdapter(res);

	const jwtPayload = await middleware.verify(request, response);
	const activeSessions = await middleware.sessionManager.readAll(jwtPayload.sub);
	response.send(activeSessions);
});
server.put('/session', async (req, res) => {
	const request = new FastifyRequestAdapter(req);
	const response = new FastifyResponseAdapter(res);

	await middleware.refresh(request, response, { role: 'user' }, { subject: request.query('uid')! });
	response.send();
});
server.delete('/session', async (req, res) => {
	const request = new FastifyRequestAdapter(req);
	const response = new FastifyResponseAdapter(res);

	const jwtPayload = await middleware.verify(request, response);
	await middleware.delete(request, response, jwtPayload);

	response.send();
});
server.delete('/sessions', async (req, res) => {
	const request = new FastifyRequestAdapter(req);
	const response = new FastifyResponseAdapter(res);

	const jwtPayload = await middleware.verify(request, response);
	const deletedSessions = await middleware.sessionManager.deleteAll(jwtPayload);

	response.send({ sessions: deletedSessions });
});

export { server };

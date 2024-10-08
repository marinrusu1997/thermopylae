<h1 align="center">@thermopylae/core.jwt-session</h1>
<p>
  <img alt="Version" src="https://img.shields.io/badge/version-0.0.1-blue.svg?cacheSeconds=2592000" />
  <img alt="Node Version" src="https://img.shields.io/badge/node-%3E%3D16-blue.svg"/>
<a href="https://marinrusu1997.github.io/thermopylae/core.jwt-session/index.html" target="_blank">
  <img alt="Documentation" src="https://img.shields.io/badge/documentation-yes-brightgreen.svg" />
</a>
<a href="https://github.com/marinrusu1997/thermopylae/blob/master/LICENSE" target="_blank">
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
</a>
</p>

> JWT user session for HTTP interface.

## Install

```sh
npm install @thermopylae/core.jwt-session
```

## Description
This package contains Http Middleware for jwt user session management.
It uses [@thermopylae/lib.jwt-user-session][lib-jwt-session-link] for session management
and contains implementation for repositories required by the library.

## Usage
```typescript
import { LoggerManagerInstance, OutputFormat } from '@thermopylae/core.logger';
import { ConnectionType, initLogger as initRedisClientLogger, RedisClientInstance, RedisConnectionOptions } from '@thermopylae/core.redis';
import { initLogger as initUserSessionCommonsLogger, UserSessionRedisStorage } from '@thermopylae/core.user-session.commons';
import { FastifyRequestAdapter, FastifyResponseAdapter, AdaptedFastifyRequest, LOCATION_SYM } from '@thermopylae/core.adapter.fastify';
import { GeoIpLocator, GeoIpLiteRepository } from '@thermopylae/lib.geoip';
import { AVRO_SERIALIZER } from '@thermopylae/core.user-session.commons/dist/storage/serializers/jwt/avro';
import { FastifyReply } from 'fastify';
import { HttpStatusCode } from '@thermopylae/core.declarations';
import { initLogger as initCoreJwtSessionLogger, InvalidAccessTokensMemCache, JwtUserSessionMiddleware } from '@thermopylae/core.jwt-session';

(async function main() {
	/* Configure logging */
	LoggerManagerInstance.formatting.setDefaultFormattingOrder(OutputFormat.PRINTF);
	LoggerManagerInstance.console.createTransport({ level: 'info' });

	/* Init loggers */
	initRedisClientLogger();
	initCoreJwtSessionLogger();
	initUserSessionCommonsLogger();

	/* Connect to Redis Server */
	const redisClientOptions: RedisConnectionOptions = {
		host: '127.0.0.1',
		port: 6379,
		password: '09}KNng90/mng89;',
		connect_timeout: 10_000,
		max_attempts: 10,
		retry_max_delay: 5_000,
		attachDebugListeners: new Set(['end', 'reconnecting'])
	};

	await RedisClientInstance.connect({
		[ConnectionType.REGULAR]: {
			...redisClientOptions,
			detect_buffers: true // very important, REQUIRED
		},
		[ConnectionType.SUBSCRIBER]: redisClientOptions
	});

	/* Enable Key Space Notification Events (REQUIRED) */
	await RedisClientInstance.client.config('SET', 'notify-keyspace-events', 'Kgxe');

	/* Configure Geoip (OPTIONAL) */
	const geoip = new GeoIpLocator([new GeoIpLiteRepository(1)]);

	/* Configure Middleware */
	const middleware = new JwtUserSessionMiddleware({
		jwt: {
			secret: 'secret',
			signOptions: {
				algorithm: 'HS384',
				issuer: 'auth-server.com',
				audience: ['auth-server.com', 'rest-server.com'],
				expiresIn: 900 // 15 min
			},
			verifyOptions: {
				algorithms: ['HS384'],
				issuer: 'auth-server.com',
				audience: 'rest-server.com'
			},
			invalidationOptions: {
				refreshTokenTtl: 86_400, // 24h
				refreshTokenLength: 24,
				invalidAccessTokensCache: new InvalidAccessTokensMemCache(),
				refreshTokensStorage: new UserSessionRedisStorage({
					keyPrefix: {
						sessions: 'reftoks',
						sessionId: 'reftok'
					},
					concurrentSessions: 3,
					serializer: AVRO_SERIALIZER
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
	});

	/* Define Route Handler */
	async function createSession(req: AdaptedFastifyRequest, res: FastifyReply): Promise<void> {
		const request = new FastifyRequestAdapter(req);
		const response = new FastifyResponseAdapter(res);

		req[LOCATION_SYM] = await geoip.locate(request.ip);

		try {
			await middleware.create(request, response, { role: 'user' }, { subject: 'uid1' });
			response.status(HttpStatusCode.Created).send();
		} catch (e) {
			response.status(HttpStatusCode.BadRequest).send({ message: e.message });
		}
	}
})();
```

## API Reference
API documentation is available [here][api-doc-link].

It can also be generated by issuing the following commands:
```shell
git clone git@github.com:marinrusu1997/thermopylae.git
cd thermopylae
yarn install
yarn workspace @thermopylae/core.jwt-session run doc
```

## Author
👤 **Rusu Marin**

* GitHub: [@marinrusu1997](https://github.com/marinrusu1997)
* Email: [dimarusu2000@gmail.com](mailto:dimarusu2000@gmail.com)
* LinkedIn: [@marinrusu1997](https://www.linkedin.com/in/rusu-marin-1638b0156/)

## 📝 License
Copyright © 2021 [Rusu Marin](https://github.com/marinrusu1997). <br/>
This project is [MIT](https://github.com/marinrusu1997/thermopylae/blob/master/LICENSE) licensed.

[api-doc-link]: https://marinrusu1997.github.io/thermopylae/core.jwt-session/index.html
[lib-jwt-session-link]: https://marinrusu1997.github.io/thermopylae/lib.jwt-user-session/index.html

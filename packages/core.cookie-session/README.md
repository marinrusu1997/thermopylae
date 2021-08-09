<h1 align="center">@thermopylae/core.cookie-session</h1>
<p>
  <img alt="Version" src="https://img.shields.io/badge/version-0.0.1-blue.svg?cacheSeconds=2592000" />
  <img alt="Node Version" src="https://img.shields.io/badge/node-%3E%3D16-blue.svg"/>
<a href="https://marinrusu1997.github.io/thermopylae/core.cookie-session/index.html" target="_blank">
  <img alt="Documentation" src="https://img.shields.io/badge/documentation-yes-brightgreen.svg" />
</a>
<a href="https://github.com/marinrusu1997/thermopylae/blob/master/LICENSE" target="_blank">
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
</a>
</p>

> Cookie user session for HTTP interface.

## Install

```sh
npm install @thermopylae/core.cookie-session
```

## Description
This package contains Http Middleware for cookie user session management.
It uses [@thermopylae/lib.user-session][lib-user-session-link] for session management
and contains implementation for repositories required by the library.

## Usage
```typescript
import { LoggerManagerInstance, OutputFormat } from '@thermopylae/core.logger';
import { ConnectionType, initLogger as initRedisClientLogger, RedisClientInstance, RedisConnectionOptions } from '@thermopylae/core.redis';
import { initLogger as initUserSessionCommonsLogger } from '@thermopylae/core.user-session.commons';
import { GeoIpLiteRepository, GeoIpLocator } from '@thermopylae/lib.geoip';
import { UserSessionManager } from '@thermopylae/lib.user-session';
import { AVRO_SERIALIZER } from '@thermopylae/core.user-session.commons/dist/storage/serializers/cookie/avro';
import { ExpressRequestAdapter, ExpressResponseAdapter, AdaptedExpressRequest, LOCATION_SYM } from '@thermopylae/core.adapter.express';
import { HttpStatusCode } from '@thermopylae/core.declarations';
import { CookieUserSessionMiddleware, initLogger as initCoreCookieSessionLogger, UserSessionRedisStorage } from '@thermopylae/core.cookie-session';
import { Response } from 'express';

(async function main() {
	/* Configure Logging */
	LoggerManagerInstance.formatting.setDefaultFormattingOrder(OutputFormat.PRINTF);
	LoggerManagerInstance.console.createTransport({ level: 'info' });

	/* Init Loggers */
	initRedisClientLogger();
	initCoreCookieSessionLogger();
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
	const middleware = new CookieUserSessionMiddleware({
		sessionManager: {
			idLength: 24,
			sessionTtl: 86_400, // 24h
			timeouts: {
				idle: 3_600, // 1h
				renewal: 43_200, // 12h
				oldSessionAvailabilityAfterRenewal: 5
			},
			renewSessionHooks: {
				onRenewMadeAlreadyFromCurrentProcess(sessionId: string) {
					console.warn(
						`Can't renew session '${UserSessionManager.hash(
							sessionId
						)}', because it was renewed already. Renew has been made from this NodeJS process.`
					);
				},
				onRenewMadeAlreadyFromAnotherProcess(sessionId: string) {
					console.warn(
						`Can't renew session '${UserSessionManager.hash(
							sessionId
						)}', because it was renewed already. Renew has been made from another NodeJS process.`
					);
				},
				onOldSessionDeleteFailure(sessionId: string, e: Error) {
					console.error(`Failed to delete renewed session '${UserSessionManager.hash(sessionId)}'.`, e);
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
	});

	/* Define Route Handler */
	async function createSession(req: AdaptedExpressRequest, res: Response): Promise<void> {
		const request = new ExpressRequestAdapter(req);
		const response = new ExpressResponseAdapter(res);

		req[LOCATION_SYM] = await geoip.locate(request.ip);

		try {
			await middleware.create(request, response, 'uid1');
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
yarn workspace @thermopylae/core.cookie-session run doc
```

## Author
👤 **Rusu Marin**

* GitHub: [@marinrusu1997](https://github.com/marinrusu1997)
* Email: [dimarusu2000@gmail.com](mailto:dimarusu2000@gmail.com)
* LinkedIn: [@marinrusu1997](https://www.linkedin.com/in/rusu-marin-1638b0156/)

## 📝 License
Copyright © 2021 [Rusu Marin](https://github.com/marinrusu1997). <br/>
This project is [MIT](https://github.com/marinrusu1997/thermopylae/blob/master/LICENSE) licensed.

[api-doc-link]: https://marinrusu1997.github.io/thermopylae/core.cookie-session/index.html
[lib-user-session-link]: https://marinrusu1997.github.io/thermopylae/lib.user-session/index.html

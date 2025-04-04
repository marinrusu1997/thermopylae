<h1 align="center">@thermopylae/lib.jwt-user-session</h1>
<p>
  <img alt="Version" src="https://img.shields.io/badge/version-0.0.1-blue.svg?cacheSeconds=2592000" />
  <img alt="Node Version" src="https://img.shields.io/badge/node-%3E%3D16-blue.svg"/>
<a href="https://marinrusu1997.github.io/thermopylae/lib.jwt-user-session/index.html" target="_blank">
  <img alt="Documentation" src="https://img.shields.io/badge/documentation-yes-brightgreen.svg" />
</a>
<a href="https://github.com/marinrusu1997/thermopylae/blob/master/LICENSE" target="_blank">
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
</a>
</p>

> Stateless user session implementation based on JsonWebTokens.

## Install

```sh
npm install @thermopylae/lib.jwt-user-session
```

## Usage

This is a simple example of how this package can be used. <br/>

First, you need to implement storage for user sessions. In this example we will build
an in-memory storage, although it's recommended to implement a persistent storage (e.g. by using Redis).

```typescript
// storage.ts
import type { Seconds } from '@thermopylae/core.declarations';
import {
	AbsoluteExpirationPolicyArgumentsBundle,
	BucketGarbageCollector,
	CacheEvent,
	EsMapCacheBackend,
	PolicyBasedCache,
	ProactiveExpirationPolicy
} from '@thermopylae/lib.cache';
import type { DeviceBase, UserSessionMetaData, UserSessionStorage } from '@thermopylae/lib.user-session.commons';

class InMemoryRefreshTokensStorage implements UserSessionStorage<DeviceBase, string> {
	private readonly cache: PolicyBasedCache<string, UserSessionMetaData<DeviceBase, string>, AbsoluteExpirationPolicyArgumentsBundle>;

	private readonly userSessions: Map<string, Set<string>>;

	public constructor() {
		const backend = new EsMapCacheBackend<string, UserSessionMetaData<DeviceBase, string>>();
		const policies = [new ProactiveExpirationPolicy<string, UserSessionMetaData<DeviceBase, string>>(new BucketGarbageCollector())];
		this.cache = new PolicyBasedCache(backend, policies);

		this.userSessions = new Map<string, Set<string>>();

		this.cache.on(CacheEvent.DELETE, (key) => {
			const [user, token] = key.split('@');
			const sessions = this.userSessions.get(user)!;

			sessions.delete(token);
			if (sessions.size === 0) {
				this.userSessions.delete(user);
			}
		});
	}

	public async insert(subject: string, refreshToken: string, metaData: UserSessionMetaData<DeviceBase, string>, ttl: Seconds): Promise<void> {
		let sessions = this.userSessions.get(subject);
		if (sessions == null) {
			sessions = new Set<string>();
			this.userSessions.set(subject, sessions);
		}

		sessions.add(refreshToken);
		this.cache.set(`${subject}@${refreshToken}`, metaData, { expiresAfter: ttl });
	}

	public async read(subject: string, refreshToken: string): Promise<UserSessionMetaData<DeviceBase, string> | undefined> {
		return this.cache.get(`${subject}@${refreshToken}`);
	}

	public async readAll(subject: string): Promise<ReadonlyMap<string, UserSessionMetaData<DeviceBase, string>>> {
		const refreshTokenToSession = new Map();

		const sessions = this.userSessions.get(subject);
		if (sessions == null) {
			return refreshTokenToSession;
		}

		for (const refreshToken of sessions) {
			refreshTokenToSession.set(refreshToken, this.cache.get(`${subject}@${refreshToken}`)!);
		}

		return refreshTokenToSession;
	}

	public async delete(subject: string, refreshToken: string): Promise<void> {
		this.cache.del(`${subject}@${refreshToken}`);
	}

	public async deleteAll(subject: string): Promise<number> {
		const sessions = Array.from(this.userSessions.get(subject) || new Set());

		for (const session of sessions) {
			this.cache.del(`${subject}@${session}`);
		}

		return sessions.length;
	}
}

export { InMemoryRefreshTokensStorage };
```

Next, we need to implement cache where access tokens that were forcibly invalidated
have to be stored.

```typescript
// cache.ts
import type { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { AbsoluteExpirationPolicyArgumentsBundle, EsMapCacheBackend, PolicyBasedCache, ProactiveExpirationPolicy } from '@thermopylae/lib.cache';
import type { InvalidAccessTokensCache } from '@thermopylae/lib.jwt-user-session';

class InMemoryInvalidAccessTokensCache implements InvalidAccessTokensCache {
	private readonly cache: PolicyBasedCache<string, UnixTimestamp | null, AbsoluteExpirationPolicyArgumentsBundle>;

	public constructor() {
		const backend = new EsMapCacheBackend<string, UnixTimestamp | null>();
		const policies = [new ProactiveExpirationPolicy<string, UnixTimestamp | null>()];
		this.cache = new PolicyBasedCache(backend, policies);
	}

	public get(refreshTokenAnchor: string): UnixTimestamp | null | undefined {
		return this.cache.get(refreshTokenAnchor);
	}

	public has(refreshTokenAnchor: string): boolean {
		return this.cache.has(refreshTokenAnchor);
	}

	public upset(refreshTokenAnchor: string, invalidatedAt: UnixTimestamp | null, ttl: Seconds): void {
		this.cache.set(refreshTokenAnchor, invalidatedAt, { expiresAfter: ttl });
	}
}

export { InMemoryInvalidAccessTokensCache };
```

Then, we can instantiate **JwtUserSessionManager** and manage user sessions.

```typescript
// session.ts
import { JwtUserSessionManager, JwtUserSessionManagerEvent } from '@thermopylae/lib.jwt-user-session';
import { InMemoryInvalidAccessTokensCache } from './cache';
import { InMemoryRefreshTokensStorage } from './storage';

(async function main() {
	/* Create manager instance */
	const manager = new JwtUserSessionManager({
		secret: '99afj9aujf907;LKOP/][;kgopj',
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
			refreshTokenLength: 15,
			invalidAccessTokensCache: new InMemoryInvalidAccessTokensCache(),
			refreshTokensStorage: new InMemoryRefreshTokensStorage()
		}
	});

	/* Attach listeners */
	manager.on(JwtUserSessionManagerEvent.SESSION_INVALIDATED, (jwtAccessToken) => {
		console.log(
			'If you have multiple instances of app (i.e. cluster mode), you need to broadcast this token to them, ' +
				'so that they can invalidate it too via JwtUserSessionManager::restrictOne'
		);
	});
	manager.on(JwtUserSessionManagerEvent.ALL_SESSIONS_INVALIDATED, (subject, accessTokenTtl) => {
		console.log(
			'If you have multiple instances of app (i.e. cluster mode), you need to broadcast these arguments to them, ' +
				'so that they can invalidate it too via JwtUserSessionManager::restrictAll'
		);
	});

	/* Create session */
	const sessionTokens = await manager.create({ name: 'John' }, { subject: 'uid1' }, { ip: '127.0.0.1' });

	/* Validate it */
	const sessionMetaData = await manager.read(sessionTokens.accessToken);
	console.log(JSON.stringify(sessionMetaData));

	/* Read active sessions */
	const activeSessions = await manager.readAll('uid1');
	console.info(`User with id 'uid1' has ${activeSessions.size} active sessions.`);

	/* Update access token */
	const refreshedAccessToken = await manager.update(sessionTokens.refreshToken, { name: 'John' }, { subject: 'uid1' }, { ip: '127.0.0.1' });

	/* Delete session */
	await manager.deleteOne('uid1', sessionTokens.refreshToken, await manager.read(refreshedAccessToken));

	/* Delete all sessions */
	const deletedSessionsNo = await manager.deleteAll('uid1');
	console.log(`Deleted ${deletedSessionsNo} active sessions of user with id 'uid1'.`);
})();
```

## API Reference

API documentation is available [here][api-doc-link].

It can also be generated by issuing the following commands:

```shell
git clone git@github.com:marinrusu1997/thermopylae.git
cd thermopylae
yarn install
yarn workspace @thermopylae/lib.jwt-user-session run doc
```

## Author

👤 **Rusu Marin**

- GitHub: [@marinrusu1997](https://github.com/marinrusu1997)
- Email: [dimarusu2000@gmail.com](mailto:dimarusu2000@gmail.com)
- LinkedIn: [@marinrusu1997](https://www.linkedin.com/in/rusu-marin-1638b0156/)

## 📝 License

Copyright © 2021 [Rusu Marin](https://github.com/marinrusu1997). <br/>
This project is [MIT](https://github.com/marinrusu1997/thermopylae/blob/master/LICENSE) licensed.

[api-doc-link]: https://marinrusu1997.github.io/thermopylae/lib.jwt-user-session/index.html

<h1 align="center">@thermopylae/lib.user-session</h1>
<p>
  <img alt="Version" src="https://img.shields.io/badge/version-0.0.1-blue.svg?cacheSeconds=2592000" />
  <img alt="Node Version" src="https://img.shields.io/badge/node-%3E%3D16-blue.svg"/>
<a href="https://marinrusu1997.github.io/thermopylae/lib.user-session/index.html" target="_blank">
  <img alt="Documentation" src="https://img.shields.io/badge/documentation-yes-brightgreen.svg" />
</a>
<a href="https://github.com/marinrusu1997/thermopylae/blob/master/LICENSE" target="_blank">
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
</a>
</p>

> Stateful implementation of the user session.

## Install

```sh
npm install @thermopylae/lib.user-session
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
import type { UserSessionMetaData, UserSessionsStorage } from '@thermopylae/lib.user-session';
import type { DeviceBase, SessionId } from '@thermopylae/lib.user-session.commons';

class InMemoryUserSessionStorage implements UserSessionsStorage<DeviceBase, string> {
	private readonly cache: PolicyBasedCache<string, UserSessionMetaData<DeviceBase, string>, AbsoluteExpirationPolicyArgumentsBundle>;

	private readonly userSessions: Map<string, Set<string>>;

	public constructor() {
		const backend = new EsMapCacheBackend<string, UserSessionMetaData<DeviceBase, string>>();
		const policies = [new ProactiveExpirationPolicy<string, UserSessionMetaData<DeviceBase, string>>(new BucketGarbageCollector())];
		this.cache = new PolicyBasedCache(backend, policies);

		this.userSessions = new Map<string, Set<string>>();

		this.cache.on(CacheEvent.DELETE, (sessionIdKey) => {
			const [subject, sessionId] = InMemoryUserSessionStorage.decodeSessionIdKey(sessionIdKey);

			const sessions = this.userSessions.get(subject)!;

			sessions.delete(sessionId);
			if (sessions.size === 0) {
				this.userSessions.delete(subject);
			}
		});
	}

	public async insert(subject: string, sessionId: SessionId, metaData: UserSessionMetaData<DeviceBase, string>, ttl: Seconds): Promise<void> {
		let sessions = this.userSessions.get(subject);
		if (sessions == null) {
			sessions = new Set<string>();
			this.userSessions.set(subject, sessions);
		}

		sessions.add(sessionId);
		this.cache.set(InMemoryUserSessionStorage.sessionIdKey(subject, sessionId), metaData, { expiresAfter: ttl });
	}

	public async read(subject: string, sessionId: SessionId): Promise<UserSessionMetaData<DeviceBase, string> | undefined> {
		return this.cache.get(InMemoryUserSessionStorage.sessionIdKey(subject, sessionId));
	}

	public async readAll(subject: string): Promise<ReadonlyMap<SessionId, Readonly<UserSessionMetaData<DeviceBase, string>>>> {
		const sessions = this.userSessions.get(subject);
		if (sessions == null) {
			return new Map();
		}

		const sessionsMetaData = new Map<SessionId, UserSessionMetaData<DeviceBase, string>>();
		for (const sessionId of sessions) {
			sessionsMetaData.set(sessionId, this.cache.get(InMemoryUserSessionStorage.sessionIdKey(subject, sessionId))!);
		}
		return sessionsMetaData;
	}

	public async updateAccessedAt(subject: string, sessionId: SessionId, metaData: UserSessionMetaData<DeviceBase, string>): Promise<void> {
		this.cache.set(InMemoryUserSessionStorage.sessionIdKey(subject, sessionId), metaData);
	}

	public async delete(subject: string, sessionId: SessionId): Promise<void> {
		this.cache.del(InMemoryUserSessionStorage.sessionIdKey(subject, sessionId));
	}

	public async deleteAll(subject: string): Promise<number> {
		const sessions = Array.from(this.userSessions.get(subject) || new Set<string>());

		for (const sessionId of sessions) {
			this.cache.del(InMemoryUserSessionStorage.sessionIdKey(subject, sessionId));
		}

		return sessions.length;
	}

	private static sessionIdKey(subject: string, sessionId: SessionId): string {
		return `${subject}:${sessionId}`;
	}

	private static decodeSessionIdKey(sessionIdKey: string): [string, SessionId] {
		return sessionIdKey.split(':') as [string, SessionId];
	}
}

export { InMemoryUserSessionStorage };
```

After that, we can create our **UserSessionManager** instance and manage user sessions.

```typescript
// session.ts
import { UserSessionManager } from '@thermopylae/lib.user-session';
import { InMemoryUserSessionStorage } from './storage';

const manager = new UserSessionManager({
	idLength: 24,
	sessionTtl: 86_400, // 24h
	timeouts: {
		idle: 1_800, // 30 min
		renewal: 43_200, // 12h
		oldSessionAvailabilityAfterRenewal: 5 // 5 seconds
	},
	storage: new InMemoryUserSessionStorage(),
	renewSessionHooks: {
		onRenewMadeAlreadyFromCurrentProcess(sessionId) {
			console.warn(
				`Can't renew session '${UserSessionManager.hash(sessionId)}', because it was renewed already. Renew has been made from this NodeJS process.`
			);
		},
		onRenewMadeAlreadyFromAnotherProcess(sessionId) {
			console.warn(
				`Can't renew session '${UserSessionManager.hash(sessionId)}', because it was renewed already. Renew has been made from another NodeJS process.`
			);
		},
		onOldSessionDeleteFailure(sessionId, error) {
			console.error(`Failed to delete renewed session '${UserSessionManager.hash(sessionId)}'.`, error);
		}
	}
});

(async function main() {
	/* Create session */
	let sessionId = await manager.create('uid1', { ip: '127.0.0.1' });

	/* Read it */
	const [sessionMetaData, renewedSessionId] = await manager.read('uid1', sessionId, { ip: '127.0.0.1' });
	console.log(`Session meta data associated with session id '${sessionId}': ${JSON.stringify(sessionMetaData)}`);
	if (renewedSessionId != null) {
		console.warn(`User session was renewed and the new session id '${renewedSessionId}' needs to be sent to client.`);
		sessionId = renewedSessionId; // the old one is no longer valid
	}

	/* Read all active sessions */
	const activeSessions = await manager.readAll('uid1');
	console.log(`User with id 'uid1' has ${activeSessions.size} active sessions.`);

	/* Delete session */
	await manager.delete('uid1', sessionId);

	/* Delete all sessions */
	const deletedSessionsNo = await manager.deleteAll('uid1');
	console.info(`Deleted ${deletedSessionsNo} active sessions of user with id 'uid1'.`);
})();
```

## API Reference

API documentation is available [here][api-doc-link].

It can also be generated by issuing the following commands:

```shell
git clone git@github.com:marinrusu1997/thermopylae.git
cd thermopylae
yarn install
yarn workspace @thermopylae/lib.user-session run doc
```

## Author

👤 **Rusu Marin**

- GitHub: [@marinrusu1997](https://github.com/marinrusu1997)
- Email: [dimarusu2000@gmail.com](mailto:dimarusu2000@gmail.com)
- LinkedIn: [@marinrusu1997](https://www.linkedin.com/in/rusu-marin-1638b0156/)

## 📝 License

Copyright © 2021 [Rusu Marin](https://github.com/marinrusu1997). <br/>
This project is [MIT](https://github.com/marinrusu1997/thermopylae/blob/master/LICENSE) licensed.

[api-doc-link]: https://marinrusu1997.github.io/thermopylae/lib.user-session/index.html

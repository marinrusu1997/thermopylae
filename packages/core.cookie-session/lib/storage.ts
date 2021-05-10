import { CommitType } from '@thermopylae/lib.cookie-session';
import type { SessionsStorage, UserSessionMetaData } from '@thermopylae/lib.cookie-session';
import type { HTTPRequestLocation } from '@thermopylae/core.declarations/lib';
import type { UserSessionDevice } from './typings';

interface UserSessionsStorageOptions {
	/**
	 * Maximum number of concurrent sessions that a user can have. <br/>
	 * Creating a new session above this threshold will result in an error. <br/>
	 * When left *undefined*, user can have an unlimited number of sessions.
	 */
	readonly concurrentSessions?: number;
}

class UserSessionsStorage implements SessionsStorage<UserSessionDevice, HTTPRequestLocation> {
	private readonly options: UserSessionsStorageOptions;

	public constructor(options: UserSessionsStorageOptions) {
		this.options = options;
	}

	insert(sessionId: string, metaData: UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>, ttl: number): Promise<void> {
		throw new Error('Method not implemented.');
	}

	read(sessionId: string): Promise<UserSessionMetaData<UserSessionDevice, HTTPRequestLocation> | undefined> {
		throw new Error('Method not implemented.');
	}

	readAll(subject: string): Promise<ReadonlyMap<string, Readonly<UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>>>> {
		throw new Error('Method not implemented.');
	}

	update(sessionId: string, metaData: Partial<UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>>, commitType: CommitType): Promise<void> {
		throw new Error('Method not implemented.');
	}

	delete(sessionId: string): Promise<void> {
		throw new Error('Method not implemented.');
	}

	deleteAll(subject: string): Promise<number> {
		throw new Error('Method not implemented.');
	}
}

export { UserSessionsStorage };

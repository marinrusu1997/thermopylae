import type { RefreshTokensStorage, UserSessionMetaData } from '@thermopylae/lib.jwt-session';
import type { HTTPRequestLocation } from '@thermopylae/core.declarations';
import { RedisClientInstance } from '@thermopylae/core.redis';
import type { JwtSessionDevice } from '../typings';

class RefreshTokensRedisStorage implements RefreshTokensStorage<JwtSessionDevice, HTTPRequestLocation> {
	public insert(subject: string, refreshToken: string, metaData: UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation>, ttl: number): Promise<void> {}

	read(subject: string, refreshToken: string): Promise<UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation> | undefined> {
		throw new Error('Method not implemented.');
	}

	readAll(subject: string): Promise<UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation>[]> {
		throw new Error('Method not implemented.');
	}

	delete(subject: string, refreshToken: string): Promise<void> {
		throw new Error('Method not implemented.');
	}

	deleteAll(subject: string): Promise<number> {
		throw new Error('Method not implemented.');
	}
}

export { RefreshTokensRedisStorage };

import type { InvalidAccessTokensCache } from '@thermopylae/lib.jwt-session';

class InvalidAccessTokensMemCache implements InvalidAccessTokensCache {
	upset(accessToken: string, invalidatedAt: number | null, ttl: number): void {
		throw new Error('Method not implemented.');
	}

	has(accessToken: string): boolean {
		throw new Error('Method not implemented.');
	}

	get(accessToken: string): number | null | undefined {
		throw new Error('Method not implemented.');
	}
}

export { InvalidAccessTokensMemCache };

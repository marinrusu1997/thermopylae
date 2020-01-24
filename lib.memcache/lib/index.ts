import { MemCache } from './memcache';

let defaultCache: MemCache | null = null;

function getDefaultMemCache(): MemCache {
	if (!defaultCache) {
		defaultCache = new MemCache<string, any>();
	}
	return defaultCache;
}

export { MemCache, getDefaultMemCache };

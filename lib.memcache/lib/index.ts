import { MemCache } from './memcache';

let defaultCache: MemCache | null = null;

function getDefaultMemCache(): MemCache {
	/* istanbul ignore else  */
	if (!defaultCache) {
		defaultCache = new MemCache<string, any>();
	}
	return defaultCache;
}

export { MemCache, getDefaultMemCache };

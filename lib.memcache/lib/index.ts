import { MemCache } from './mem-cache';
import { MemSetCache } from './mem-set-cache';
import { INFINITE_TTL } from './garbage-collector';

let defaultCache: MemCache | null = null;

function getDefaultMemCache(): MemCache {
	if (!defaultCache) {
		defaultCache = new MemCache<string, any>();
	}
	return defaultCache;
}

let defaultMemSetCache: MemSetCache | null = null;

function getDefaultMemSetCache(): MemSetCache {
	if (!defaultMemSetCache) {
		defaultMemSetCache = new MemSetCache<string>();
	}
	return defaultMemSetCache;
}

export { MemCache, getDefaultMemCache, MemSetCache, getDefaultMemSetCache, INFINITE_TTL };

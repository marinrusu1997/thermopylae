import { afterEach } from 'mocha';
import chai from 'chai';
import chaiArrays from 'chai-arrays';
import { config as dotEnvConfig } from 'dotenv';

const dotEnv = dotEnvConfig();
if (dotEnv.error) {
	throw dotEnv.error;
}

chai.use(chaiArrays);

function cacheFactory<T>(constructor: any, opts?: any): T {
	if (process.env.USE_GLOBAL_CACHE_FOR_TESTS === 'true' && !opts) {
		// @ts-ignore
		if (!cacheFactory.globalCaches.has(constructor)) {
			// @ts-ignore
			cacheFactory.globalCaches.set(constructor, new constructor());
		}
		// @ts-ignore
		return cacheFactory.globalCaches.get(constructor);
	}
	// @ts-ignore
	return new constructor(opts);
}
cacheFactory.globalCaches = new Map();

afterEach(() => {
	cacheFactory.globalCaches.forEach((cache) => cache.clear());
});

export { chai, cacheFactory };

import { nowInSeconds } from '../../utils';

const storage = new WeakMap();

/**
 * Private class data
 *
 * @param {object} _this This of the class
 * @return {{
 *     client: object,
 *     prefix: string,
 *     clean: boolean
 * }}
 */
const internal = _this => {
	let data = storage.get(_this);
	if (!data) {
		data = {};
		storage.set(_this, data);
	}
	return data;
};

/**
 * Resolves key prefix used for token storage
 *
 * @param {string | undefined | null} keyPrefix Prefix for the keys
 */
const getPrefix = keyPrefix => {
	if (!keyPrefix) {
		return 'jwt-blist';
	}
	return keyPrefix.trim().replace(/\s/g, '');
};

/**
 * Compute key for tokens held by subject from an audience
 *
 * @param {string} keyPrefix Prefix used for key (i.e. namespace)
 * @param {string} audience Audience of the token
 * @param {string} subject Subject who owns the token
 */
const keyFor = (keyPrefix, audience, subject) => {
	return `${keyPrefix}-${audience}-${subject}`;
};

/**
 * Parses the Redis object into JS model
 *
 * @param {Object} result Result returned by Redis
 * @return {IBlacklistModel} Blacklist Model used by JS impl
 */
const parse = result => ({
	revoke: result.revoke ? result.revoke.split(',').map(iat => Number(iat)) : undefined,
	purge: result.purge ? Number(result.purge) : undefined
});

/**
 * Check whether token is blacklisted
 * Does additional check to ensure blacklist from storage is not expired
 *
 * @param {number}  token Timestamp when token was issued
 * @param {IBlacklistModel}  blacklist Blacklist for a subject
 * @param {number}  ttl Time To Live for this token
 * @return {{isBlacklisted: boolean, isExpired: boolean}} Checks statuses
 */
const check = (token, blacklist, ttl) => {
	let isBlacklisted = false;
	let isExpired = true;
	const watermark = nowInSeconds() - ttl;
	if (blacklist.purge && blacklist.purge > watermark) {
		isExpired = false;
		if (token <= blacklist.purge) {
			isBlacklisted = true;
			return {
				isBlacklisted,
				isExpired
			};
		}
	}
	if (blacklist.revoke) {
		let revoked;
		for (let i = 0; i < blacklist.revoke.length; i += 1) {
			revoked = blacklist.revoke[i];
			if (revoked > watermark) {
				isExpired = false;
				if (token === revoked) {
					isBlacklisted = true;
					return {
						isBlacklisted,
						isExpired
					};
				}
			}
		}
	}
	return {
		isBlacklisted,
		isExpired
	};
};

/**
 * Clean expired tokens from blacklist
 *
 * @param {IBlacklistModel} blacklist Blacklist of the subject
 * @param {number} ttl TTL for tokens
 */
const clear = (blacklist, ttl) => {
	const now = nowInSeconds();
	const list = blacklist;
	if (list.revoke) {
		list.revoke = blacklist.revoke.filter(iat => iat > now - ttl);
	}
	if (list.purge && blacklist.purge <= now - ttl) {
		list.purge = null;
	}
	return list;
};

/**
 * Tries to perform cleaning of expired tokens from blacklist,
 * if this option was specified for purge/revoke operations
 *
 * @param {boolean}             clean       Flag which indicates if cleaning must be performed
 * @param {IBlacklistModel}     blacklist   Blacklist of the subject
 * @param {number}              ttl         TTL for tokens
 * @return {IBlacklistModel}                Cleared blacklist
 * @throws {Error}                          When no TTL provided
 */
const performClear = (clean, blacklist, ttl) => {
	if (clean) {
		if (!ttl) {
			throw new Error('TTL is mandatory when using Redis Storage in clean mode');
		}
		return clear(blacklist, ttl);
	}
	return blacklist;
};

/**
 * Stores blacklist of the subject in the Redis storage
 *
 * @param {Object} client Redis client with async API
 * @param {IBlacklistModel} blacklist Blacklist of the subject
 * @param {string} key Key for the blacklist
 * @return {Promise<void>}
 */
const store = async (client, blacklist, key) => {
	const args = [];
	const multi = client.multi();
	if (blacklist.revoke) {
		args.push('revoke', blacklist.revoke.toString());
	}
	// if no revoke, dont touch it, we need empty arr, our logic is based on this
	// once created, it must remain
	if (blacklist.purge) {
		args.push('purge', blacklist.purge.toString());
	} else {
		multi.hdel(key, ['purge']);
	}
	multi.hmset(key, args);
	return multi.execAsync();
};

/**
 * Redis Storage
 * @implements {IAbstractStorage}
 */
class RedisStorage {
	constructor(opts) {
		const privateThis = internal(this);
		privateThis.client = opts.redis;
		privateThis.prefix = getPrefix(opts.keyPrefix);
		privateThis.clean = opts.clean || false;
	}

	async has(query) {
		const { prefix, client } = internal(this);
		const { audience, subject, issued, ttl } = query;
		const key = keyFor(prefix, audience, subject);
		const blist = await client.hgetallAsync(key);
		if (!blist) {
			return false;
		}
		if (!ttl) {
			throw new Error('Redis storage requires ttl in order to distinguish between expired tokens');
		}
		const { isBlacklisted, isExpired } = check(issued, parse(blist), ttl);
		if (isExpired) {
			await client.delAsync(key);
		}
		return isBlacklisted;
	}

	async revoke(audience, subject, issuedAt, ttl) {
		const { prefix, client, clean } = internal(this);
		const key = keyFor(prefix, audience, subject);
		const blist = await client.hgetallAsync(key);
		if (!blist) {
			client.hmsetAsync(key, 'revoke', issuedAt.toString());
			return;
		}
		const subjectBlist = performClear(clean, parse(blist), ttl);
		if (subjectBlist.revoke) {
			subjectBlist.revoke.push(issuedAt);
		} else {
			subjectBlist.revoke = [issuedAt];
		}
		await store(client, subjectBlist, key);
	}

	async purge(audience, subject, ttl) {
		const { prefix, client, clean } = internal(this);
		const key = keyFor(prefix, audience, subject);
		const blist = await client.hgetallAsync(key);
		const now = nowInSeconds();
		if (!blist) {
			client.hmsetAsync(key, 'purge', now.toString());
			return;
		}
		const subjectBlist = performClear(clean, parse(blist), ttl);
		subjectBlist.purge = now;
		await store(client, subjectBlist, key);
	}

	async clear(tokens) {
		if (!tokens) {
			throw new Error('Redis storage needs tokens map in order to be able to reconstruct keys');
		}
		const { prefix, client } = internal(this);
		tokens.forEach((subjects, audience) => {
			subjects.forEach(async subject => {
				await client.delAsync(keyFor(prefix, audience, subject));
			});
		});
	}

	/**
	 * Returns the key prefix used for creating Redis store keys
	 *
	 * @returns {string}
	 */
	keyPrefix() {
		return internal(this).prefix;
	}
}

export default RedisStorage;
export { RedisStorage };

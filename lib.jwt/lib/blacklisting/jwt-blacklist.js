const storage = new WeakMap();

/**
 * Private class data
 *
 * @param {Object} _this This of the class
 * @return {{
 *    allTTL: number | undefined
 *    underlyingStorage: IAbstractStorage | undefined
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
 * Performs basic check against manager state
 *
 * @param {IAbstractStorage}     underlyingStorage    Storage used by manager
 * @return {void}
 * @throws {Error}   When a criteria is not met
 */
const stateCheck = underlyingStorage => {
	if (!underlyingStorage) {
		throw new Error('Storage is not defined');
	}
};

/**
 * Performs basic check against jwt payload
 *
 * @param {IIssuedJWTPayload}    token    Token which needs to be validated
 * @return {void}
 * @throws {Error}   When a criteria is not met
 */
const payloadCheck = token => {
	if (!token.sub) {
		throw new Error('Jwt needs to contain sub property');
	}
	if (!token.iat) {
		throw new Error('Jwt needs to contain iat property');
	}
	if (!token.exp) {
		throw new Error('Jwt needs to contain exp property');
	}
};

/**
 * Resolves the TTL that needs to be passed to underlying storage as optional argument
 * TTL priorities:
 *    1) Explicit TTL
 *    2) Computed TTL from tokens with explicit audience (exp-iat)
 *    3) TTL for @all audience, when no explicit audience on token
 *
 * @param {IIssuedJWTPayload?}   token         Token which needs to be validated
 * @param {number?}              allTTL        TTL used for @all audience
 * @param {number?}  explicitTTL   Explicit TTL provided on revoke/purge operations
 *
 * @returns {number}    TTL in seconds
 * @throws  {Error}     When TTL cannot be determined
 *
 * @api private
 */
const getTTL = (token, allTTL, explicitTTL) => {
	if (explicitTTL) {
		return explicitTTL;
	}
	if (token && token.aud) {
		return token.exp - token.iat;
	}
	if (allTTL) {
		return allTTL;
	}
	throw new Error('No TTL for operation');
};

class JWTBlacklist {
	static get allAudience() {
		return '@all';
	}

	async init(underlyingStorage, allTTL) {
		const privateThis = internal(this);
		if (privateThis.underlyingStorage) {
			throw new Error('Storage defined already');
		}
		privateThis.underlyingStorage = underlyingStorage;
		privateThis.allTTL = allTTL;
		if (allTTL && underlyingStorage.defineAudience) {
			await underlyingStorage.defineAudience(JWTBlacklist.allAudience, allTTL);
		}
	}

	get allTtl() {
		return internal(this).allTTL;
	}

	async defineAudiences(audiences) {
		const { underlyingStorage } = internal(this);
		if (!underlyingStorage) {
			throw new Error('Storage is not defined');
		}
		if (!underlyingStorage.defineAudience) {
			throw new Error('Underlying storage does not suport static audience defining');
		}
		const promises = [];
		for (let i = 0; i < audiences.length; i += 1) {
			promises.push(
				(async () => {
					try {
						await underlyingStorage.defineAudience(audiences[i].name, audiences[i].ttl);
						return true;
					} catch (e) {
						return e;
					}
				})()
			);
		}
		return Promise.all(promises);
	}

	async isBlacklisted(token) {
		const { underlyingStorage, allTTL } = internal(this);
		const audience = token.aud || JWTBlacklist.allAudience;
		stateCheck(underlyingStorage);
		payloadCheck(token);
		return underlyingStorage.has({
			audience,
			subject: token.sub,
			issued: token.iat,
			ttl: getTTL(token, allTTL)
		});
	}

	async revoke(token, ttl) {
		const { underlyingStorage, allTTL } = internal(this);
		const audience = token.aud || JWTBlacklist.allAudience;
		stateCheck(underlyingStorage);
		payloadCheck(token);
		await underlyingStorage.revoke(audience, token.sub, token.iat, getTTL(token, allTTL, ttl));
	}

	async purge(sub, aud, ttl) {
		const { underlyingStorage, allTTL } = internal(this);
		const audience = aud || JWTBlacklist.allAudience;
		stateCheck(underlyingStorage);
		await underlyingStorage.purge(audience, sub, getTTL(null, allTTL, ttl));
	}
}

export default JWTBlacklist;
export { JWTBlacklist };

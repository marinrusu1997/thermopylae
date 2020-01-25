import jsonwebtoken, { JsonWebTokenError } from 'jsonwebtoken';
import { JWTBlacklist } from '../blacklisting/jwt-blacklist';

const storage = new WeakMap();
/**
 * Private class data
 *
 * @param {Object} _this This of the class
 * @return {{
 *    secret: string | Buffer | IPubPrivKeys,
 *    signVerifyOpts: ISignVerifyOpts | undefined,
 *    blacklistManager: JWTBlacklist | undefined
 * }}
 * @api private
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
 * Validator for secret used when signing/verifying tokens
 *
 * @param {string | Buffer | IPubPrivKeys}  secret  Provided secret
 * @throws {Error}    When secret format is invalid
 * @api private
 */
const validateSecret = secret => {
	if (
		typeof secret === 'string' ||
		secret instanceof Buffer ||
		(typeof secret === 'object' &&
			secret !== null &&
			(typeof secret.priv === 'string' || secret.priv instanceof Buffer) &&
			(typeof secret.pub === 'string' || secret.pub instanceof Buffer))
	) {
		return;
	}
	throw new JsonWebTokenError('Invalid secret type');
};

function isEmptyObject(obj) {
	return Object.entries(obj).length === 0 && obj.constructor === Object;
}

/**
 * Gets the secret for sign/verify opts from stored one into local state
 *
 * @param {string | Buffer | IPubPrivKeys}          secret    Secret stored in local state
 * @param {string}                                  keyType   For asymmetric encryption (priv/pub)
 * @param {SignOptions | VerifyOptions | undefined} options   Options used for the operation
 * @returns {string|Buffer}   Secret for operation. Secret is a string of Buffer, depends how it was supplied
 * @throws {JsonWebTokenError}            When no options provided when using RSA/ECDSA key pair
 * @api private
 */
const getSecret = (secret, keyType, options) => {
	/** Testing for HMAC key */
	if (typeof secret === 'string' || secret instanceof Buffer) {
		return secret;
	}
	/** Testing for RSA/ECDSA key */
	if (!options || isEmptyObject(options)) {
		throw new JsonWebTokenError('Options are needed when using RSA/ECDSA key pair');
	}
	return secret[keyType];
};

/**
 * Gets the options needed for sign/verify operations.
 * Will build an options object which contains default provided options,
 * which can be overwritten by custom provided options.
 *
 * @param {SignOptions | VerifyOptions}   custom    			Custom provided options on operation invocation
 * @param {ISignVerifyOpts | undefined}   defaultOptions  		Default options specified at instance initialization
 * @param {string}                        opType    			Type of the operation (sign/verify)
 * @returns {SignOptions | VerifyOptions | undefined}   		Options for operation invocation
 * @api private
 */
const getOptions = (custom, defaultOptions, opType) => ({
	...(defaultOptions ? defaultOptions[opType] : undefined),
	...custom
});

/**
 * Verify token signature and decodes it if valid
 *
 * @param {string | Buffer }    secret   Secret used when token was signed
 * @param {string}              token    Jwt
 * @param {VerifyOptions}       options  Verify options
 * @return {IIssuedJWTPayload}           Decoded Jwt Payload
 * @throws {JsonWebTokenError}           When token is not valid
 */
const verify = (secret, token, options) => {
	return jsonwebtoken.verify(token, secret, options);
};

class Jwt {
	constructor(opts) {
		const privateThis = internal(this);
		validateSecret(opts.secret);
		privateThis.secret = opts.secret;
		privateThis.blacklistManager = opts.blacklisting ? new JWTBlacklist() : undefined;
		privateThis.signVerifyOpts = opts.signVerifyOpts;
	}

	sign(payload, options) {
		const { secret, signVerifyOpts } = internal(this);
		const usingOptions = getOptions(options, signVerifyOpts, 'sign');
		return jsonwebtoken.sign(payload, getSecret(secret, 'priv', usingOptions), usingOptions);
	}

	async validate(token, options) {
		const { secret, signVerifyOpts, blacklistManager } = internal(this);
		const usingOptions = getOptions(options, signVerifyOpts, 'verify');
		const jwt = verify(getSecret(secret, 'pub', usingOptions), token, usingOptions);
		if (blacklistManager && (await blacklistManager.isBlacklisted(jwt))) {
			throw new JsonWebTokenError(`Token ${JSON.stringify(jwt)} is blacklisted`);
		}
		return jwt;
	}

	blacklist() {
		const { blacklistManager } = internal(this);
		if (!blacklistManager) {
			throw new Error('No blacklisting support configured');
		}
		return blacklistManager;
	}
}

export default Jwt;
export { Jwt };

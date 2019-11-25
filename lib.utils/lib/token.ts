import { hash, argon2id, verify } from 'argon2';
import { randomBytes as randomBytesCallbackVersion } from 'crypto';
import { promisify } from 'util';

interface Tokens {
	plain: string;
	hash?: string;
}

const randomBytes = promisify(randomBytesCallbackVersion);

/**
 * Options used by hash functions
 *
 * @type {{type: *}}
 */
const options = { type: argon2id };

/**
 *  Generates a random token.
 *  Transforms the token into format which needs to be stored in the persistent storage.
 *
 *  @param {number}     size         Token size
 *  @param {boolean}    [doHash]     Flag which indicates whether to hash token or not

 * @returns {Promise<Tokens>}
 */
async function generateToken(size: number, doHash?: boolean): Promise<Tokens> {
	const token: Tokens = {
		plain: (await randomBytes(size)).toString('hex').substr(0, size)
	};
	if (doHash) {
		token.hash = await hashToken(token.plain);
	}
	return token;
}

/**
 * Hashes a given token
 *
 * @param {string}  plain     Token which needs to be hashed
 *
 * @return {Promise<string>} Hashed token
 */
function hashToken(plain: string): Promise<string> {
	return hash(plain, options);
}

/**
 * Compares stored and received from client tokens
 *
 * @param {string}  stored      Stored token
 * @param {string}  received    Received token from client
 * @param {boolean} [doHash]    Flag which indicates to compare hashed version of the received token
 *
 * @returns {Promise<boolean>}
 */
async function compareTokens(stored: string, received: string, doHash?: boolean): Promise<boolean> {
	let areEquals = false;
	if (!doHash) {
		areEquals = stored === received;
	} else {
		try {
			areEquals = await verify(stored, received, options);
		} catch (e) {
			areEquals = false;
		}
	}
	return areEquals;
}

export { hashToken, generateToken, compareTokens };

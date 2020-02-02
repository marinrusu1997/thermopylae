import { hash as argon2Hash, argon2id, verify } from 'argon2';
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
async function generate(size: number, doHash?: boolean): Promise<Tokens> {
	const token: Tokens = {
		plain: (await randomBytes(size)).toString('hex').substr(0, size)
	};
	if (doHash) {
		token.hash = await hash(token.plain);
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
function hash(plain: string): Promise<string> {
	return argon2Hash(plain, options);
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
async function compare(stored: string, received: string, doHash?: boolean): Promise<boolean> {
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

/**
 * this is a very fast hashing but its un-secure
 * @link http://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript-jquery
 * @return a number as hash-result
 */
function fastUnSecureHash(obj: any): number {
	if (typeof obj !== 'string') obj = JSON.stringify(obj);
	let hashValue = 0;
	let i;
	let chr;
	let len;
	if (obj.length === 0) return hashValue;
	for (i = 0, len = obj.length; i < len; i++) {
		chr = obj.charCodeAt(i);
		// eslint-disable-next-line no-bitwise
		hashValue = (hashValue << 5) - hashValue + chr;
		// eslint-disable-next-line no-bitwise
		hashValue |= 0; // Convert to 32bit integer
	}
	if (hashValue < 0) hashValue *= -1;
	return hashValue;
}

export { hash, generate, compare, fastUnSecureHash };

import { v1, v4 } from 'uuid';
import { createException } from './exception';

const enum ErrorCodes {
	UNKNOWN_TOKEN_GENERATION_TYPE = 'UNKNOWN_TOKEN_GENERATION_TYPE'
}

const enum TokenGenerationType {
	CRYPTOGRAPHYCAL = 'CRYPTOGRAPHYCAL',
	NORMAL = 'NORMAL'
}

const UUID_DEFAULT_LENGTH = 32;
const UUID_BUFFER_OFFSET = 16;

function generate(generationType = TokenGenerationType.CRYPTOGRAPHYCAL, length = UUID_DEFAULT_LENGTH): string {
	let alg;

	switch (generationType) {
		case TokenGenerationType.CRYPTOGRAPHYCAL:
			alg = v4;
			break;
		case TokenGenerationType.NORMAL:
			alg = v1;
			break;
		default:
			throw createException(
				ErrorCodes.UNKNOWN_TOKEN_GENERATION_TYPE,
				`Received: ${generationType}. Allowed: ${TokenGenerationType.CRYPTOGRAPHYCAL}, ${TokenGenerationType.NORMAL}`
			);
	}

	const iterations = Math.ceil(length / UUID_DEFAULT_LENGTH);

	const buffer = Buffer.alloc(iterations * UUID_BUFFER_OFFSET);

	for (let i = 0; i < iterations; i++) {
		alg(null, buffer, i * UUID_BUFFER_OFFSET);
	}

	return buffer.toString('hex').slice(0, length);
}

/**
 * this is a very fast hashing but its un-secure
 * @link http://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript-jquery
 * @return a number as hash-result
 */
function fastUnSecureHash(obj: any): number {
	if (typeof obj !== 'string') {
		obj = JSON.stringify(obj);
	}

	let hashValue = 0;
	let i;
	let chr;
	let len;
	if (obj.length === 0) {
		return hashValue;
	}

	for (i = 0, len = obj.length; i < len; i++) {
		chr = obj.charCodeAt(i);
		// eslint-disable-next-line no-bitwise
		hashValue = (hashValue << 5) - hashValue + chr;
		// eslint-disable-next-line no-bitwise
		hashValue |= 0; // Convert to 32bit integer
	}

	if (hashValue < 0) {
		hashValue *= -1;
	}

	return hashValue;
}

export { ErrorCodes, TokenGenerationType, UUID_DEFAULT_LENGTH, generate, fastUnSecureHash };

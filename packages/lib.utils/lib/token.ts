import type { ObjMap } from '@thermopylae/core.declarations';
import { v1, v4 } from 'uuid';
import { createException } from './exception.js';

const enum ErrorCodes {
	UNKNOWN_TOKEN_GENERATION_TYPE = 'UNKNOWN_TOKEN_GENERATION_TYPE'
}

/** Specifies how token has to be generated. */
const enum TokenGenerationType {
	/** Create a cryptographic secure token. */
	CRYPTOGRAPHIC = 'CRYPTOGRAPHIC',
	/** Create a normal token using RFC version 1 (timestamp). */
	NORMAL = 'NORMAL'
}

const UUID_DEFAULT_LENGTH = 32;
const UUID_BUFFER_OFFSET = 16;

/**
 * Generate random token.
 *
 * @param   generationType Token generation type.
 * @param   length         Length of the token.
 *
 * @returns                Random token.
 */
function generate(generationType = TokenGenerationType.CRYPTOGRAPHIC, length = UUID_DEFAULT_LENGTH): string {
	let alg;

	switch (generationType) {
		case TokenGenerationType.CRYPTOGRAPHIC:
			alg = v4;
			break;
		case TokenGenerationType.NORMAL:
			alg = v1;
			break;
		default:
			throw createException(
				ErrorCodes.UNKNOWN_TOKEN_GENERATION_TYPE,
				`Received: ${generationType}. Allowed: ${TokenGenerationType.CRYPTOGRAPHIC}, ${TokenGenerationType.NORMAL}`
			);
	}

	const iterations = Math.ceil(length / UUID_DEFAULT_LENGTH);

	const buffer = Buffer.alloc(iterations * UUID_BUFFER_OFFSET);

	for (let i = 0; i < iterations; i++) {
		alg(undefined, buffer, i * UUID_BUFFER_OFFSET);
	}

	return buffer.toString('hex').slice(0, length);
}

/**
 * Creates a hash of the object is a very fast manner, but its un-secure.
 *
 * @param   obj Object to be hashed.
 *
 * @returns     A number as hash-result.
 */
function fastUnSecureHash(obj: string | ObjMap): number {
	// see http://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript-jquery

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
		hashValue = (hashValue << 5) - hashValue + chr;
		hashValue |= 0; // Convert to 32bit integer
	}

	if (hashValue < 0) {
		hashValue *= -1;
	}

	return hashValue;
}

export { ErrorCodes, TokenGenerationType, generate, fastUnSecureHash };

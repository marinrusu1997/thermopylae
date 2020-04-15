import { v1, v4 } from 'uuid';
import { createException } from './exception';

const enum ErrorCodes {
	UNKNOWN_TOKEN_GENERATION_TYPE = 'UNKNOWN_TOKEN_GENERATION_TYPE'
}

const enum TokenGenerationType {
	CRYPTOGRAPHYCAL = 'CRYPTOGRAPHYCAL',
	NORMAL = 'NORMAL'
}

function generate(generationType: TokenGenerationType = TokenGenerationType.CRYPTOGRAPHYCAL): string {
	switch (generationType) {
		case TokenGenerationType.CRYPTOGRAPHYCAL:
			return v4();
		case TokenGenerationType.NORMAL:
			return v1();
		default:
			throw createException(
				ErrorCodes.UNKNOWN_TOKEN_GENERATION_TYPE,
				`Received: ${generationType}. Allowed: ${TokenGenerationType.CRYPTOGRAPHYCAL}, ${TokenGenerationType.NORMAL}`
			);
	}
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

export { ErrorCodes, TokenGenerationType, generate, fastUnSecureHash };

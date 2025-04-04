import { createCipheriv, createDecipheriv } from 'crypto';
import type { BinaryLike, CipherCCMOptions, CipherCCMTypes, CipherGCMOptions, CipherGCMTypes, CipherKey } from 'crypto';
import type { TransformOptions } from 'stream';

/**
 * Options used for secrets encryption (e.g. password hash, totp secret etc.). <br/> Detailed
 * explanation can be found
 * [here](https://nodejs.org/api/crypto.html#crypto_crypto_createcipheriv_algorithm_key_iv_options).
 */
interface SecretEncryptionOptions {
	/** Encryption algorithm. */
	algorithm: CipherCCMTypes | CipherGCMTypes | string;
	/** Cipher key secret. */
	secret: CipherKey;
	/** Initialization vector. */
	iv: BinaryLike | null;
	/** Encryption options. */
	options?: CipherCCMOptions | CipherGCMOptions | TransformOptions;
}

/** @private */
class SecretEncryptor {
	private readonly options: SecretEncryptionOptions | false;

	public constructor(options: SecretEncryptionOptions | false) {
		this.options = options;
	}

	public encrypt(secret: string): string {
		if (this.options !== false) {
			// https://codeforgeek.com/encrypt-and-decrypt-data-in-node-js/
			const cypher = createCipheriv(this.options.algorithm, this.options.secret, this.options.iv, this.options.options);
			return cypher.update(secret, 'utf8', 'hex') + cypher.final('hex');
		}

		return secret;
	}

	public decrypt(secret: string): string {
		if (this.options === false) {
			return secret;
		}

		const decipher = createDecipheriv(this.options.algorithm, this.options.secret, this.options.iv, this.options.options);
		return decipher.update(secret, 'hex', 'utf8') + decipher.final('utf8');
	}
}

export { SecretEncryptor };
export type { SecretEncryptionOptions };

import { createCipheriv, createDecipheriv } from 'crypto';
import type { CipherCCMTypes, CipherGCMTypes, CipherKey, BinaryLike, CipherCCMOptions, CipherGCMOptions } from 'crypto';
import type { TransformOptions } from 'stream';

interface SecretEncryptionOptions {
	algorithm: CipherCCMTypes | CipherGCMTypes | string;
	secret: CipherKey;
	iv: BinaryLike | null;
	options?: CipherCCMOptions | CipherGCMOptions | TransformOptions;
}

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

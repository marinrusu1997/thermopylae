import { type CipherGCMTypes, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { Brand } from 'ts-brand';
import { deepFreeze } from '../deep-freeze.js';
import { createException } from '../exception.js';

interface FastSymmetricEncryptedPayload {
	keyId: Brand<string, 'keyId'>;
	iv: string;
	authTag: string;
	ciphertext: string;
}

enum FastSymmetricEncryptionErrorCodes {
	NOT_FOUND = 'NOT_FOUND',
	EMPTY_KEY_STORE = 'EMPTY_KEY_STORE',
	INVALID_ENCRYPTION_KEY = 'INVALID_ENCRYPTION_KEY'
}

class FastSymmetricEncryption {
	static #ALGORITHM: CipherGCMTypes = 'aes-256-gcm';
	static #ENCODING: BufferEncoding = 'base64';

	readonly #keyStore: ReadonlyMap<FastSymmetricEncryptedPayload['keyId'], Buffer>;
	readonly #activeKeyId: FastSymmetricEncryptedPayload['keyId'];

	public constructor({
		keyStore,
		activeKeyId
	}: {
		keyStore: ReadonlyMap<FastSymmetricEncryptedPayload['keyId'], string>;
		activeKeyId: FastSymmetricEncryptedPayload['keyId'];
	}) {
		if (!keyStore.has(activeKeyId)) {
			throw createException(FastSymmetricEncryptionErrorCodes.NOT_FOUND, `Active key id '${activeKeyId}' not found in key store.`);
		}

		if (keyStore.size === 0) {
			throw createException(FastSymmetricEncryptionErrorCodes.EMPTY_KEY_STORE, `Keystore can't be empty.`);
		}
		for (const [keyId, key] of keyStore) {
			FastSymmetricEncryption.#assertIsValidEncryptionKey(keyId, key);
		}

		this.#activeKeyId = activeKeyId;
		this.#keyStore = deepFreeze(new Map(keyStore.entries().map(([keyId, key]) => [keyId, Buffer.from(key, 'base64')])));

		Object.freeze(this);
	}

	static {
		Object.freeze(this);
	}

	#getKey(keyId: FastSymmetricEncryptedPayload['keyId']): Buffer {
		const key = this.#keyStore.get(keyId);
		if (!key) {
			throw createException(FastSymmetricEncryptionErrorCodes.NOT_FOUND, `Key with id '${this.#activeKeyId}' not found in key store.`);
		}
		return key;
	}

	encrypt(text: string): FastSymmetricEncryptedPayload {
		const key = this.#getKey(this.#activeKeyId);
		const iv = randomBytes(12); // 96 bits for GCM
		const cipher = createCipheriv(FastSymmetricEncryption.#ALGORITHM, key, iv);

		const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
		const authTag = cipher.getAuthTag();

		return {
			keyId: this.#activeKeyId,
			iv: iv.toString(FastSymmetricEncryption.#ENCODING),
			authTag: authTag.toString(FastSymmetricEncryption.#ENCODING),
			ciphertext: ciphertext.toString(FastSymmetricEncryption.#ENCODING)
		};
	}

	decrypt(payload: FastSymmetricEncryptedPayload): string {
		const key = this.#getKey(payload.keyId);
		const iv = Buffer.from(payload.iv, FastSymmetricEncryption.#ENCODING);
		const authTag = Buffer.from(payload.authTag, FastSymmetricEncryption.#ENCODING);
		const ciphertext = Buffer.from(payload.ciphertext, FastSymmetricEncryption.#ENCODING);

		const decipher = createDecipheriv(FastSymmetricEncryption.#ALGORITHM, key, iv);
		decipher.setAuthTag(authTag);

		const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

		return decrypted.toString('utf8');
	}

	static #assertIsValidEncryptionKey(keyId: FastSymmetricEncryptedPayload['keyId'], key: string): void | never {
		let buffer: Buffer<ArrayBuffer> | null = null;
		try {
			buffer = Buffer.from(key, 'base64');
		} catch {
			throw createException(FastSymmetricEncryptionErrorCodes.INVALID_ENCRYPTION_KEY, `Key with id '${keyId}' is not a valid base64 encryption key.`);
		}

		if (buffer.length !== 32) {
			throw createException(FastSymmetricEncryptionErrorCodes.INVALID_ENCRYPTION_KEY, `Key with id '${keyId}' needs to be a 32 bytes length.`);
		}
	}
}

export { FastSymmetricEncryption };
export type { FastSymmetricEncryptedPayload, FastSymmetricEncryptionErrorCodes };

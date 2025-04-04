import { deepFreeze, encryption } from '@thermopylae/lib.utils';
import { randomBytes } from 'node:crypto';

const FAST_SYMMETRIC_ENCRYPTION = new encryption.FastSymmetricEncryption({
	keyStore: deepFreeze(
		new Map(['v1', 'v2', 'v3'].map((keyId) => [<encryption.FastSymmetricEncryptedPayload['keyId']>keyId, randomBytes(32).toString('base64')]))
	),
	activeKeyId: <encryption.FastSymmetricEncryptedPayload['keyId']>'v2'
});

export { FAST_SYMMETRIC_ENCRYPTION };

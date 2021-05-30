import { Authenticator } from '@otplib/core';
import type { AuthenticatorOptions } from '@otplib/core';
import { keyDecoder, keyEncoder } from '@otplib/plugin-thirty-two';
import { createDigest, createRandomBytes } from '@otplib/plugin-crypto';
import type { RequireSome } from '@thermopylae/core.declarations/lib';
import { createCipheriv, createDecipheriv } from 'crypto';
import type { CipherCCMTypes, CipherGCMTypes, CipherKey, BinaryLike, CipherCCMOptions, CipherGCMOptions } from 'crypto';
import type { TransformOptions } from 'stream';
import type { TwoFactorAuthStrategy } from './interface';
import type { AccountModel } from '../types/models';

interface AccountWithTotpSecret extends AccountModel {
	totpSecret: string;
}

interface TotpBaseTwoFactorAuthStrategyOptions {
	encryption: {
		algorithm: CipherCCMTypes | CipherGCMTypes | string;
		secret: CipherKey;
		iv: BinaryLike | null;
		options?: CipherCCMOptions | CipherGCMOptions | TransformOptions;
	};
	secretLength: number;
	authenticator: Readonly<
		Omit<
			RequireSome<AuthenticatorOptions<string>, 'algorithm' | 'digits' | 'encoding' | 'step' | 'window'>,
			'createDigest' | 'createHmacKey' | 'digest' | 'epoch' | 'createRandomBytes' | 'keyEncoder' | 'keyDecoder'
		>
	>;
}

abstract class TotpBaseTwoFactorAuthStrategy<Account extends AccountWithTotpSecret> implements TwoFactorAuthStrategy<Account> {
	private readonly baseOptions: TotpBaseTwoFactorAuthStrategyOptions;

	protected readonly authenticator: Authenticator;

	protected constructor(options: TotpBaseTwoFactorAuthStrategyOptions) {
		this.authenticator = new Authenticator({
			...options.authenticator,
			createDigest,
			createRandomBytes,
			keyDecoder,
			keyEncoder
		});
		this.baseOptions = options;
	}

	public async beforeRegister(account: Account): Promise<void> {
		const totpSecret = this.authenticator.generateSecret(this.baseOptions.secretLength);
		const cypher = createCipheriv(
			this.baseOptions.encryption.algorithm,
			this.baseOptions.encryption.secret,
			this.baseOptions.encryption.iv,
			this.baseOptions.encryption.options
		);
		account.totpSecret = cypher.update(totpSecret, 'utf8', 'hex') + cypher.final('hex');
	}

	public abstract sendToken(account: Account): Promise<void>;

	public abstract verifyToken(account: Account, token: string): Promise<boolean>;

	protected getTotpSecret<Acc extends AccountWithTotpSecret>(account: Acc): string {
		const decipher = createDecipheriv(
			this.baseOptions.encryption.algorithm,
			this.baseOptions.encryption.secret,
			this.baseOptions.encryption.iv,
			this.baseOptions.encryption.options
		);
		return decipher.update(account.totpSecret, 'hex', 'utf8') + decipher.final('utf8');
	}
}

export { TotpBaseTwoFactorAuthStrategy };
export type { TotpBaseTwoFactorAuthStrategyOptions, AccountWithTotpSecret };

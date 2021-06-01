import { Authenticator } from '@otplib/core';
import type { AuthenticatorOptions } from '@otplib/core';
import { keyDecoder, keyEncoder } from '@otplib/plugin-thirty-two';
import { createDigest, createRandomBytes } from '@otplib/plugin-crypto';
import type { RequireSome } from '@thermopylae/core.declarations/lib';
import { createCipheriv, createDecipheriv } from 'crypto';
import type { CipherCCMTypes, CipherGCMTypes, CipherKey, BinaryLike, CipherCCMOptions, CipherGCMOptions } from 'crypto';
import type { TransformOptions } from 'stream';
import type { AuthenticationSessionRepositoryHolder } from '../sessions/authentication';
import type { TwoFactorAuthStrategy } from './interface';
import type { AccountModel } from '../types/models';
import type { AuthenticationContext } from '../types/requests';
import type { TwoFactorAuthAChannelType } from '../types/enums';

interface AccountWithTotpSecret extends AccountModel {
	totpSecret: string;
}

interface TotpSecretEncryptionOptions {
	algorithm: CipherCCMTypes | CipherGCMTypes | string;
	secret: CipherKey;
	iv: BinaryLike | null;
	options?: CipherCCMOptions | CipherGCMOptions | TransformOptions;
}

interface TotpBaseTwoFactorAuthStrategyOptions {
	encryption: TotpSecretEncryptionOptions | false;
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

	public abstract readonly type: TwoFactorAuthAChannelType;

	public abstract beforeRegister(account: Account, registerResponse: Record<string, any>): Promise<void>;

	public abstract sendToken(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<void>;

	public abstract isTokenValid(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<boolean>;

	protected generateAndSetTotpSecret(account: Account): string {
		const totpSecret = this.authenticator.generateSecret(this.baseOptions.secretLength);
		account.totpSecret = totpSecret;

		if (this.baseOptions.encryption !== false) {
			// https://codeforgeek.com/encrypt-and-decrypt-data-in-node-js/
			const cypher = createCipheriv(
				this.baseOptions.encryption.algorithm,
				this.baseOptions.encryption.secret,
				this.baseOptions.encryption.iv,
				this.baseOptions.encryption.options
			);
			account.totpSecret = cypher.update(account.totpSecret, 'utf8', 'hex') + cypher.final('hex');
		}

		return totpSecret;
	}

	protected getTotpSecret<Acc extends AccountWithTotpSecret>(account: Acc): string {
		if (this.baseOptions.encryption === false) {
			return account.totpSecret;
		}

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
export type { TotpBaseTwoFactorAuthStrategyOptions, TotpSecretEncryptionOptions, AccountWithTotpSecret };

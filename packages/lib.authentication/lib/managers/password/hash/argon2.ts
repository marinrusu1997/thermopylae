import { hash, verify } from 'argon2';
import type { Options } from 'argon2';
import type { RequireSome } from '@thermopylae/core.declarations';
import type { PasswordHash, PasswordHashingAlgorithm } from './index';

/**
 * [Documentation](https://github.com/ranisalt/node-argon2/wiki/Options).
 */
type HashingOptions = Readonly<Omit<RequireSome<Options, 'hashLength' | 'memoryCost' | 'parallelism' | 'type'>, 'raw' | 'version' | 'salt'>>;

class Argon2PasswordHashingAlgorithm implements PasswordHashingAlgorithm {
	private readonly hashingOptions: HashingOptions;

	public constructor(hashingOptions: HashingOptions) {
		this.hashingOptions = hashingOptions;
	}

	public async hash(password: string): Promise<PasswordHash> {
		return {
			passwordHash: await hash(password, this.hashingOptions)
		};
	}

	public async verify(hashedPassword: PasswordHash, plain: string): Promise<boolean> {
		return verify(hashedPassword.passwordHash, plain, this.hashingOptions);
	}
}

export { Argon2PasswordHashingAlgorithm };

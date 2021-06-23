import { hash, verify } from 'argon2';
import type { Options } from 'argon2';
import type { RequireSome } from '@thermopylae/core.declarations';
import type { PasswordHash, PasswordHashingAlgorithm } from './index';

/**
 * [Documentation](https://github.com/ranisalt/node-argon2/wiki/Options).
 */
type Argon2PasswordHashingOptions = Readonly<Omit<RequireSome<Options, 'hashLength' | 'memoryCost' | 'parallelism' | 'type'>, 'raw' | 'version' | 'salt'>>;

class Argon2PasswordHashingAlgorithm implements PasswordHashingAlgorithm {
	private readonly hashingOptions: Argon2PasswordHashingOptions;

	public constructor(hashingOptions: Argon2PasswordHashingOptions) {
		this.hashingOptions = hashingOptions;
	}

	public async hash(password: string): Promise<PasswordHash> {
		return {
			passwordHash: await hash(password, this.hashingOptions)
		};
	}

	public async verify(plainPassword: string, hashedPassword: string): Promise<boolean> {
		return verify(hashedPassword, plainPassword, this.hashingOptions);
	}
}

export { Argon2PasswordHashingAlgorithm, Argon2PasswordHashingOptions };
